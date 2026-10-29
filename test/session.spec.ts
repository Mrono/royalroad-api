import assert from 'node:assert';
import { before, describe, it } from 'node:test';
import { RoyalRoadAPI } from '../src/royalroad';

describe('browser sessions', () => {
    let rr: RoyalRoadAPI;

    before(async () => {
        rr = new RoyalRoadAPI();
    });

    it('should reuse one browser for several requests', async () => {
        await rr.startSession();

        try {
            const fiction = await rr.fiction.getFiction(21220);
            const chapter = await rr.chapter.getChapter(fiction.data.chapters[0].id);

            assert(fiction.success);
            assert(chapter.success);
        } finally {
            await rr.endSession();
        }
    });
});
