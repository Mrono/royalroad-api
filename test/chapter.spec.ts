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
        for (const note of chapter.data.notes) {
            assert(note.position === 'top' || note.position === 'bottom');
        }
    });
});
