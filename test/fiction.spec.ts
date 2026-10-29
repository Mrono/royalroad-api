import assert from 'assert';
import { describe, before, it } from 'node:test';
import { RoyalRoadAPI } from '../src/royalroad';

describe('fiction functionality', () => {
    let rr: RoyalRoadAPI;

    before(async () => {
        rr = new RoyalRoadAPI();
    });

    it('should get a fiction', async () => {
        const fictionId = 9685;
        const expectedFictionTitle = 'Pantheon: Online';
        const expectedFictionAuthorId = 49920;

        const fiction = await rr.fiction.getFiction(fictionId);

        assert(fiction.success);
        assert.strictEqual(fiction.data.title, expectedFictionTitle);
        assert.strictEqual(fiction.data.author.id, expectedFictionAuthorId);
        assert(fiction.data.description.length !== 0);
        assert(fiction.data.type.length !== 0);
        assert(Array.isArray(fiction.data.tags));
        assert(fiction.data.chapters.length > 0);
        assert(Number.isInteger(fiction.data.chapters[0].id));
        assert(!Number.isNaN(fiction.data.chapters[0].release));
    });
});
