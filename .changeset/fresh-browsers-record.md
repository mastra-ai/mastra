---
'@mastra/stagehand': patch
'@mastra/agent-browser': patch
---

Add alpha opt-in browser video recording support to the Stagehand and Agent Browser providers. Both providers now accept `recording: { outputDir }` and, when enabled, expose `browser_record` and `browser_record_caption` alongside their existing browser tools.

Example:

```ts
const browser = new AgentBrowser({
  recording: { outputDir: './browser-recordings' },
});
```
