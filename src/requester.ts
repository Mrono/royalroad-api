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
        const server = process.env.PLAYWRIGHT_SERVER?.replace(/\/+$/, '');
        if (!server) {
            throw new RoyalError('The PLAYWRIGHT_SERVER environment variable is not set.');
        }

        const url = this.url + path;
        this.debug('GET %o via /%s', url, endpoint);

        let page: BrowserPage;
        try {
            const res = await fetch(`${server}/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, seed: BROWSER_SEED }),
            });

            if (!res.ok) {
                throw new Error(`browser service ${res.status}: ${await res.text()}`);
            }

            page = (await res.json()) as BrowserPage;
        } catch (error: unknown) {
            this.debug('request error %O', error);
            throw new RoyalError(error instanceof Error ? error.message : 'Unknown error');
        }

        this.debug('%o < %o', url, page.url);

        const genericError = Requester.catchGenericError(page.html);
        if (genericError !== null) {
            throw new RoyalError(genericError);
        }

        return page;
    }
}