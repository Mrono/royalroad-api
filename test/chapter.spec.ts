import { before, describe, it } from 'node:test';
import { RoyalRoadAPI } from '../src/royalroad';
import assert from 'node:assert';

describe('chapter functionality', () => {
    let rr: RoyalRoadAPI;

    before(async () => {
        rr = new RoyalRoadAPI();
    });

    it('should get a chapter', async () => {
        const chapterId = 208170;

        const chapter = await rr.chapter.getChapter(chapterId);

        assert(chapter.success);
        assert(chapter.data.title.length > 0);
        assert(chapter.data.content.length > 0);
        assert(chapter.data.release !== null);
        assert.strictEqual(typeof chapter.data.preNote, 'string');
        assert.strictEqual(typeof chapter.data.postNote, 'string');
    });
});
