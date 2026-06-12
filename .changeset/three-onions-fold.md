---
'@mastra/core': patch
'@mastra/stagehand': patch
'@mastra/agent-browser': patch
'mastracode': patch
---

Add alpha browser video recording tools as an opt-in browser provider feature. `StagehandBrowser` and `AgentBrowser` now accept `recording: { outputDir }` to add `browser_record` and `browser_record_caption` to their toolsets. Agents can start a recording, add short captions while they work, and stop the recording to save a Motion-JPEG AVI video that plays in Preview, QuickTime, VLC, and browsers without requiring `ffmpeg`.

Mastra Code enables these recording tools for its browser integration and stores videos in its app-data `browser-recordings` directory.

Example:

```ts
const browser = new AgentBrowser({
  recording: { outputDir: './browser-recordings' },
});

await browser_record({ action: 'start' });
await browser_record_caption({ text: 'Opened docs' });
await browser_record({ action: 'stop' });
```
