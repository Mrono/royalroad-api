import { ChapterService } from './services/chapter.js';
import { FictionService } from './services/fiction.js';
import { Requester } from './requester.js';

/**
 * Container class, creating instances of the separate Service classes.
 */
export class RoyalRoadAPI {
    private readonly requester = new Requester();

    public readonly chapter = new ChapterService(this.requester);
    public readonly fiction = new FictionService(this.requester);
}
