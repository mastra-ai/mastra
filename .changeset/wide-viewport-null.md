---
'@mastra/core': patch
'@mastra/stagehand': patch
---

Browser launch options now accept `viewport: null` to disable fixed viewport emulation, so the page follows the real browser window size instead of a fixed size.

```ts
const browser = new MastraBrowser({
  provider: 'stagehand',
  viewport: null, // follow the real window instead of emulating a fixed size
});
```
