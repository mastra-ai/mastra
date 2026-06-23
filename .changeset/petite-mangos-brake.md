---
'@mastra/playground-ui': minor
---

Added helpers for working with remote and cloud-storage media URLs, used by the Studio agent chat composer so media can be attached by URL and forwarded to the model untouched instead of only being uploaded as inlined base64.

- Recognizes cloud-storage URIs (`gs://`, `s3://`) so they are passed through and resolved server-side by the model provider.
- Recognizes video and audio URLs and renders them as a labeled file chip with the correct icon instead of a broken preview.

New exports:

```ts
import { isRemoteUrl, isBrowserFetchableUrl, isNonFetchableRemoteUrl } from '@mastra/playground-ui';

isRemoteUrl('gs://my-bucket/clip.mp4'); // true
isBrowserFetchableUrl('gs://my-bucket/clip.mp4'); // false (resolved server-side)
isBrowserFetchableUrl('https://example.com/clip.mp4'); // true
```
