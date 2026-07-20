---
'@mastra/stagehand': patch
---

Fixed local model execution in `StagehandBrowser` by forwarding the `experimental` and `disableAPI` options.

```ts
new StagehandBrowser({
  scope: 'shared',
  experimental: true,
  disableAPI: true,
});
```
