---
'@mastra/playground-ui': minor
---

Added `EmptyStateIllustration`, line art for empty and error states that animates on hover. Pass it to `EmptyState`'s `iconSlot`. There are eight for empty screens (`traces`, `logs`, `api-keys`, `environments`, `requests`, `databases`, `threads`, `deploys`) and five for failures (`disconnected`, `server-error`, `locked`, `not-a-member`, `rate-limited`). `tone="error"` tints it for failed loads.

```tsx
<EmptyState
  variant="fill"
  iconSlot={<EmptyStateIllustration name="logs" />}
  titleSlot="No logs yet"
  descriptionSlot="Logs appear here when your project runs."
/>
```
