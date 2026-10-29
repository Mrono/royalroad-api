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

    /**
     * Start a browser session: until endSession is called, all requests reuse
     * one browser instead of launching a new one per request.
     */
    public startSession() {
        return this.requester.startSession();
    }

    /**
     * Close the browser session started with startSession.
     */
    public endSession() {
        return this.requester.endSession();
    }
}
