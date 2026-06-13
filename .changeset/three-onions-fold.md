---
'@mastra/core': patch
---

Add alpha browser video recording primitives under `@mastra/core/browser`. The new recording helper exposes `browser_record` and `browser_record_caption`, captures browser screencast frames, burns in short captions, and saves Motion-JPEG AVI videos without requiring `ffmpeg`.

Example:

```ts
import { createBrowserRecordingTools } from '@mastra/core/browser';

const tools = createBrowserRecordingTools(browser, {
  outputDir: './browser-recordings',
});
```
