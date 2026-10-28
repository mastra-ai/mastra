---
'@mastra/core': minor
---

`@mastra/core/workspace` now exports `getMimeType`, the extension-based lookup `LocalFilesystem` uses, so custom filesystem providers can fill in `FileStat.mimeType` the same way.

```ts
import { getMimeType } from '@mastra/core/workspace';

getMimeType('page.png'); // 'image/png'
getMimeType('notes.unknown'); // 'application/octet-stream'
```
