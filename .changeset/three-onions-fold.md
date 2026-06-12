---
'@mastra/core': patch
'@mastra/stagehand': patch
'@mastra/agent-browser': patch
'mastracode': patch
---

Add alpha browser video recording tools as an opt-in browser provider feature. Agents can start a recording, add short captions while they work, and stop the recording to save an MJPEG AVI video that plays in Preview, QuickTime, VLC, and browsers. Mastra Code enables these tools for its browser integration.

Example:

```ts
await browser_record({ action: 'start' });
await browser_record_caption({ text: 'Opened docs' });
await browser_record({ action: 'stop' });
```
