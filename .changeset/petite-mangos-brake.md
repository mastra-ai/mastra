---
'@mastra/playground-ui': minor
---

Added support for attaching cloud-storage and remote media URLs in the Studio agent chat composer.

You can now attach media by URL and have it forwarded to the model untouched, instead of only uploading local files inlined as base64. This works for:

- **Cloud-storage URIs** (`gs://`, `s3://`) that the model resolves server-side (for example Vertex Gemini, which declares them in `supportedUrls`).
- **Video and audio** files by URL, which now render as a labeled file chip with the correct icon instead of a broken preview.

Helpers for working with these URL schemes are exported from `@mastra/playground-ui`:

```ts
import { isRemoteUrl, isBrowserFetchableUrl, isNonFetchableRemoteUrl } from '@mastra/playground-ui';

isRemoteUrl('gs://my-bucket/clip.mp4'); // true
isBrowserFetchableUrl('gs://my-bucket/clip.mp4'); // false (resolved server-side)
isBrowserFetchableUrl('https://example.com/clip.mp4'); // true
```
