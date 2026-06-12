---
'mastracode': patch
---

Add experimental browser video recording tools for Mastra Code only. Agents can start a recording, add short captions while they work, and stop the recording to save an MJPEG AVI video that plays in Preview, QuickTime, VLC, and browsers.

Example:

```ts
await browser_record({ action: 'start' });
await browser_record_caption({ text: 'Opened docs' });
await browser_record({ action: 'stop' });
```
