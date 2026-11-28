---
'@mastra/core': patch
---

Added `modelOverrides: false` to background tool config so fixed background tools don't add `_background` to their model-facing schema. Each overridable tool adds five optional parameters, so five strict background tools exceeded Anthropic's limit of 24 optional parameters. Set it on the tool or on an agent's per-tool entry; the tool still runs with its configured disposition.

```ts
createTool({
  id: 'research',
  strict: true,
  background: { enabled: true, modelOverrides: false },
  // ...
});
```

Fixes #28638.
