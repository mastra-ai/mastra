---
'@mastra/playground-ui': minor
---

Added illustrated empty states. Pass `illustration` to `EmptyState` to show an illustration in place of the icon: eight for empty screens (`traces`, `logs`, `api-keys`, `environments`, `requests`, `databases`, `threads`, `deploys`) and three for failures (`disconnected`, `locked`, `rate-limited`). `tone="error"` tints the illustration for failed loads.

```tsx
<EmptyState
  variant="fill"
  illustration="logs"
  titleSlot="No logs yet"
  descriptionSlot="Logs appear here when your project runs."
/>
```
