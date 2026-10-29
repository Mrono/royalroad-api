An unofficial API for [royalroad.com](https://royalroad.com).

```
npm i -s @fsoc/royalroadl-api
```

This is an attempt to write a predictable and consistent wrapper around the mess that is RR. Since no official public API is exposed, this module scrapes all data straight from the HTML, which makes it very prone to spontaneous and horrible death.

This version is read-only: it loads fiction and chapter pages, and has no login, posting or other features that change anything on RR. Pages are loaded through an [invisible_playwright](https://github.com/feder-cr/invisible_playwright) browser service with `/fetch` and `/chapters` endpoints, whose address is read from the `PLAYWRIGHT_SERVER` environment variable (for example `PLAYWRIGHT_SERVER=http://localhost:8000`).

Barebones documentation generated from [TypeDoc](http://typedoc.org/) can be found on [fs-c.github.io/royalroad-api/](https://fs-c.github.io/royalroad-api/). You can also build these docs yourself by running `npm run docs` in the root of the project.

## Example usage

```typescript
import { RoyalRoadAPI } from '@fsoc/royalroadl-api';

const api = new RoyalRoadAPI();

const { data: fiction } = await api.fiction.getFiction(21220);
console.log(`${fiction.title} has ${fiction.chapters.length} chapters`);

const { data: chapter } = await api.chapter.getChapter(fiction.chapters[0].id);
console.log(chapter.title, new Date(chapter.release ?? 0), chapter.preNote, chapter.postNote);
```

### Browser sessions

By default every request launches a new browser, which takes several seconds. To reuse one browser (and its cookies) for many requests, wrap them in a session:

```typescript
await api.startSession();
try {
    const { data: fiction } = await api.fiction.getFiction(21220);
    for (const { id } of fiction.chapters) {
        const { data: chapter } = await api.chapter.getChapter(id);
    }
} finally {
    await api.endSession();
}
```

The browser service closes sessions that go unused for `SESSION_IDLE_SECONDS` (300 by default); if that happens mid-run, the next request starts a new session automatically.

## About

The module itself exports only a `RoyalRoadAPI` class which, by itself, has no methods. All functionality is delegated to service classes which are properties of the `RoyalRoadAPI` instance.

### Responses

All responses and errors are either an instance of a [`RoyalResponse`](https://fsoc.gitlab.io/royalroadl-api/classes/royalresponse.html) or a [`RoyalError`](https://fsoc.gitlab.io/royalroadl-api/classes/royalerror.html), which extends `RoyalResponse`. This is done to easily allow for meta information to be tacked onto responses, and to have a consistent interface between user and module. Note that the `RoyalError` acts similarly to the NodeJS `Error` object, in that it captures and returns a short stack trace.

For example, a call to `RoyalRoadAPI#fiction.getFiction()` might yield the following response on success:

```javascript
RoyalResponse {
  data:
   { type: 'Original',
     tags: [ 'Action', 'Adventure', 'Sci-fi', ... 3 more items ],
     stats:
      { pages: 766,
        ratings: 719,
        followers: 2991,
        favorites: 690,
        views: [Object],
        score: [Object] },
     title: 'Paladin',
     image:
      'https://www.royalroadcdn.com/(...)',
     status: 'HIATUS',
     author:
      { name: 'Komikhan',
        title: '',
        avatar:
         'https://www.royalroadcdn.com/(...)',
        id: 66486 },
     warnings: [ 'Gore', 'Profanity' ],
     chapters: [ [Object], [Object], [Object], ... 71 more items ],
     description:
      'When the first derelict alien spacecraft fell to Earth, (...)' },
  success: true,
  timestamp: 1528119296799 }
```

...or on error:

```javascript
RoyalError {
  data:
   { message: 'Page Not Found',
     stack:
      [ 'Error',
        '    at new RoyalError', ... 8 more items ] },
  success: false,
  timestamp: 1528119381034 }
```

### Internal requester

All service classes use the same instance of the `Requester`, the class responsible for loading pages through the browser service. Fiction pages are loaded with the `/chapters` endpoint, which also returns the page's `window.chapters` array; that array is used for a fiction's chapter list instead of parsing the paginated chapter table.

Since RR likes to return 200 even when the actual response should be a 404, the `Requester` will parse the HTML it has gotten and try to read an error from it. If it finds signs that the request has failed, it will throw a `RoyalError`.

### Structure

All services are structured in a very similar way: with a `<Type>Service` exposing all relevant methods, and a `<Type>Parser`, which usually exposes a number of static methods used to parse HTML responses.

-   `FictionService`, `getFiction(id)` returns a fiction's title, image, status, warnings, description, author and chapters.
-   `ChapterService`, `getChapter(id)` returns a chapter's title, release date, content, `preNote` (the author note above the chapter text) and `postNote` (the one below it), each `''` if there is none.

### Parsing

This uses [cheerio](https://github.com/cheeriojs/cheerio) to parse HTML, which is a very forgiving parser. This means that even if RRL were to make minor changes to their page layouts, large parts of the API (even those parts responsible for changed areas) would still remain functional.

Therefore, expect properties to be empty or `null`, and know that an error will not be thrown just because some values could not be parsed.

## Contributing

PRs are welcome!

### Tests

Can be run with `npm run test`, requires a `.env` file pointing `PLAYWRIGHT_SERVER` at a running browser service, see `sample.env`.

When adding/fixing a feature please add/modify the tests.
