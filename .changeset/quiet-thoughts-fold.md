---
'@mastra/playground-ui': patch
---

Added a `defaultOpen` option to the reasoning block (`Reasoning` and `ReasoningPartRenderer`), so apps can start reasoning collapsed. It defaults to `true`, so existing views are unchanged. While reasoning streams, the "Reasoning" label now shimmers, so a collapsed block still shows the model is thinking.

```tsx
<ReasoningPartRenderer part={part} defaultOpen={false} />
```
