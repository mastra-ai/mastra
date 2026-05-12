---
'@mastra/stagehand': patch
'@mastra/agent-browser': patch
---

Added `screenshot` tool to `@mastra/stagehand` (`stagehand_screenshot`) and `@mastra/agent-browser` (`browser_screenshot`). Captures a PNG screenshot and returns image content for vision-capable models.

Added `excludeTools` config option to opt out of specific tools:

```ts
const browser = new StagehandBrowser({
  excludeTools: ['stagehand_screenshot'],
});
```
