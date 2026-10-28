import * as cheerio from 'cheerio';
import { Requester, type RawChapter } from '../requester.js';
import { RoyalError, RoyalResponse } from '../responses.js';

export interface Fiction {
    title: string;
    image: string;
    status: string;
    warnings: string[];
    description: string;
    author: FictionAuthor;
    chapters: FictionChapter[];
}

export interface FictionChapter {
    id: number;
    title: string;
    /** Release time in milliseconds since the epoch. */
    release: number;
}

export interface FictionAuthor {
    id: number;
    name: string;
    title: string;
    avatar: string;
}

/**
 * Fiction related methods.
 */
export class FictionService {
    private readonly req: Requester;

    constructor(req: Requester) {
        this.req = req;
    }

    /**
     * Returns a Fiction object scraped from the specified fictions page, throws
     * an error if it wasn't found.
     *
     * @param id - ID of the fiction to get. (royalroadl.com/fiction/<id>)
     * @returns - Fiction object.
     */
    public async getFiction(id: number) {
        const path = `/fiction/${String(id)}`;
        const { html, chapters } = await this.req.getWithChapters(path);

        if (chapters === null) {
            throw new RoyalError('window.chapters was not found on the fiction page.');
        }

        const fiction = FictionParser.parseFiction(html, chapters);

        return new RoyalResponse(fiction);
    }
}

class FictionParser {
    public static parseFiction(html: string, rawChapters: RawChapter[]): Fiction {
        const $ = cheerio.load(html);

        const title = $('div.fic-title').find('h1').text().trim();
        const image = $('div.fic-header').find('img').attr('src') ?? '';
        const status = $('span.bg-blue-hoki').eq(1).text().trim();

        const warnings = $('ul.list-inline')
            .find('li')
            .map((i, el) => $(el).text().trim())
            .get();

        const description = $('div.description > div.hidden-content').text().trim();

        const authorEl = $('.portlet-body').eq(0);

        const author: FictionAuthor = {
            name: $(authorEl).find('.mt-card-content').find('a').text().trim(),
            title: $(authorEl).find('.mt-card-desc').text(),
            avatar: $(authorEl).find('img[data-type="avatar"]').attr('src') ?? '',
            id: +($(authorEl).find('.mt-card-content').find('a').attr('href') || '').split('/')[2],
        };

        const chapters: FictionChapter[] = rawChapters.map((chapter) => ({
            id: chapter.id,
            title: chapter.title,
            release: Date.parse(chapter.date),
        }));

        return { title, image, status, warnings, description, author, chapters };
    }
}