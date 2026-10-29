import { getBaseAddress } from './constants.js';
import * as cheerio from 'cheerio';
import { RoyalError } from './responses.js';
import debug from 'debug';

/**
 * One entry of the window.chapters array embedded in a fiction page.
 */
export interface RawChapter {
    id: number;
    volumeId: number | null;
    title: string;
    slug: string;
    date: string;
    order: number;
    visible: number;
    subscriptionTiers: unknown;
    doesNotRollOver: boolean;
    isUnlocked: boolean;
    hiddenCount: number | null;
    url: string;
}

/**
 * Response of the browser service's /fetch and /chapters endpoints.
 */
interface BrowserPage {
    url: string;
    title: string;
    html: string;
    chapters?: RawChapter[] | null;
}

/**
 * Response of the browser service's POST /session endpoint.
 */
interface BrowserSession {
    session_id: string;
    idle_timeout_s: number;
}

/**
 * Non-2xx answer from the browser service.
 */
class ServiceError extends Error {
    public readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

/**
 * Seed sent with every request, so all pages load with the same browser
 * fingerprint.
 */
const BROWSER_SEED = 42;

/**
 * Class passed to all Services. Loads pages through the invisible_playwright
 * browser service found at the PLAYWRIGHT_SERVER environment variable.
 */
export class Requester {
    /**
     * Catch generic errors like 404 and 403, since RRL always returns with
     * status code 200.
     *
     * @param html
     */
    private static catchGenericError(html: string): string | null {
        const $ = cheerio.load(html);

        // Usually 4xx, mostly 404 and 403.
        const notFound = $('div.page-404').find('h3').text().trim();
        const alert = $('div.alert.alert-danger').eq(0).text().trim();
        const error = $('div.text-danger').find('li').first().text().trim();

        return notFound || alert || error || null;
    }

    private readonly url = getBaseAddress();
    private readonly debug = debug('royalroad-api:requester');

    /** Browser session used for requests, null for a new browser each time. */
    private sessionId: string | null = null;

    get inSession() {
        return this.sessionId !== null;
    }

    /**
     * Start a browser session: until endSession is called, every request
     * reuses the same browser (and its cookies) instead of launching a new
     * one. Does nothing if a session is already running.
     */
    public async startSession(): Promise<void> {
        if (this.sessionId !== null) {
            return;
        }

        try {
            const session = await this.callService<BrowserSession>('POST', '/session', {
                seed: BROWSER_SEED,
            });
            this.sessionId = session.session_id;
        } catch (error: unknown) {
            throw Requester.toRoyalError(error);
        }

        this.debug('started session %o', this.sessionId);
    }

    /**
     * Close the browser session. Requests after this launch a new browser
     * each time again.
     */
    public async endSession(): Promise<void> {
        const id = this.sessionId;
        if (id === null) {
            return;
        }
        this.sessionId = null;

        try {
            await this.callService('DELETE', `/session/${id}`);
            this.debug('ended session %o', id);
        } catch (error: unknown) {
            // Already closed by the service (idle timeout) or unreachable
            this.debug('could not end session %o: %O', id, error);
        }
    }

    /**
     * Load a page under the base address and return its HTML.
     *
     * @param path
     */
    public async get(path: string): Promise<string> {
        const page = await this.request('fetch', path);

        return page.html;
    }

    /**
     * Load a fiction page and return its HTML together with the page's
     * window.chapters array (null if the page doesn't define it).
     *
     * @param path
     */
    public async getWithChapters(path: string) {
        const page = await this.request('chapters', path);

        return { html: page.html, chapters: page.chapters ?? null };
    }

    /**
     * Ask the browser service to load the given path, then check the
     * resulting page for a RR error message.
     *
     * @param endpoint - Browser service endpoint to use.
     * @param path
     */
    private async request(endpoint: 'fetch' | 'chapters', path: string): Promise<BrowserPage> {
        const url = this.url + path;
        this.debug('GET %o via /%s, session %o', url, endpoint, this.sessionId);

        let page: BrowserPage;
        try {
            page = await this.load(endpoint, url);
        } catch (error: unknown) {
            this.debug('request error %O', error);
            throw Requester.toRoyalError(error);
        }

        this.debug('%o < %o', url, page.url);

        const genericError = Requester.catchGenericError(page.html);
        if (genericError !== null) {
            throw new RoyalError(genericError);
        }

        return page;
    }

    /**
     * Load a page, in the current session if there is one. The service closes
     * sessions that sit idle, so on "unknown session" start a new one and
     * retry once.
     */
    private async load(endpoint: 'fetch' | 'chapters', url: string): Promise<BrowserPage> {
        const send = () =>
            this.callService<BrowserPage>('POST', `/${endpoint}`, {
                url,
                seed: BROWSER_SEED,
                session_id: this.sessionId ?? undefined,
            });

        try {
            return await send();
        } catch (error: unknown) {
            if (!(error instanceof ServiceError && error.status === 404 && this.inSession)) {
                throw error;
            }

            this.debug('session %o expired, starting a new one', this.sessionId);
            this.sessionId = null;
            await this.startSession();

            return await send();
        }
    }

    /**
     * Call the browser service at the PLAYWRIGHT_SERVER environment variable.
     */
    private async callService<T>(method: 'POST' | 'DELETE', path: string, body?: object) {
        const server = process.env.PLAYWRIGHT_SERVER?.replace(/\/+$/, '');
        if (!server) {
            throw new RoyalError('The PLAYWRIGHT_SERVER environment variable is not set.');
        }

        const res = await fetch(server + path, {
            method,
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!res.ok) {
            throw new ServiceError(
                res.status,
                `browser service ${res.status}: ${await res.text()}`,
            );
        }

        return (await res.json()) as T;
    }

    private static toRoyalError(error: unknown): RoyalError {
        if (error instanceof RoyalError) {
            return error;
        }

        return new RoyalError(error instanceof Error ? error.message : 'Unknown error');
    }
}
