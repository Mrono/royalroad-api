import * as cheerio from 'cheerio';
import { Requester } from '../requester.js';
import { RoyalResponse } from '../responses.js';

export interface Chapter {
    title: string;
    /** Release time in milliseconds since the epoch, null if not found. */
    release: number | null;
    content: string;
    /** Author note above the chapter text (HTML), '' if none. */
    preNote: string;
    /** Author note below the chapter text (HTML), '' if none. */
    postNote: string;
}

/**
 * Methods related to chapters.
 */
export class ChapterService {
    private readonly req: Requester;

    constructor(req: Requester) {
        this.req = req;
    }

    /**
     * Return a chapter given its unique ID.
     *
     * @param chapterID - ID of the chapter to get.
     */
    public async getChapter(chapterID: number) {
        const body = await this.req.get(`/fiction/0/_/chapter/${String(chapterID)}/_`);

        const chapter = ChapterParser.parseChapter(body);

        return new RoyalResponse(chapter);
    }
}

class ChapterParser {
    public static parseChapter(html: string): Chapter {
        const $ = cheerio.load(html);

        const CONTENT = 'div.chapter-inner.chapter-content';

        const content = ($(CONTENT).first().html() || '').trim();

        // Walk the author notes, the chapter text and <time> elements in page
        // order: a note before the text is the pre note, one after it the post
        // note. The chapter's own date sits above the text; times below it
        // belong to comments.
        let preNote = '';
        let postNote = '';
        let release: number | null = null;
        let afterContent = false;

        $(`${CONTENT}, div.author-note, time`).each((i, el) => {
            const $el = $(el);

            if ($el.is(CONTENT)) {
                afterContent = true;
            } else if ($el.is('time')) {
                if (!afterContent && release === null) {
                    release = ChapterParser.parseTime($el.attr('unixtime'), $el.attr('datetime'));
                }
            } else {
                const note = ($el.html() || '').trim();

                if (!afterContent && !preNote) {
                    preNote = note;
                } else if (afterContent && !postNote) {
                    postNote = note;
                }
            }
        });

        const title =
            $('div.fic-header').find('h1').first().text().trim() ||
            ChapterParser.titleFromHead($('title').text());

        return { title, release, content, preNote, postNote };
    }

    /**
     * Read a RR <time> element: unixtime is in seconds, datetime is ISO 8601.
     */
    private static parseTime(unixtime?: string, datetime?: string): number | null {
        const seconds = parseInt(unixtime ?? '', 10);
        if (!Number.isNaN(seconds)) {
            return seconds * 1000;
        }

        const parsed = Date.parse(datetime ?? '');

        return Number.isNaN(parsed) ? null : parsed;
    }

    /**
     * Fallback for the title: "<chapter> - <fiction> | Royal Road".
     */
    private static titleFromHead(head: string): string {
        const withoutSite = head.replace(/\s*\|\s*Royal Road\s*$/i, '');
        const split = withoutSite.lastIndexOf(' - ');

        return (split === -1 ? withoutSite : withoutSite.slice(0, split)).trim();
    }
}
