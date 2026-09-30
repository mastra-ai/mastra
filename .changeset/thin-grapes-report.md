---
'@mastra/react': minor
---

Added version selectors and trusted resolved run identity to `useChat`. Existing calls keep their default selection; pass `versions` to select an existing label for new runs.

```tsx
const { sendMessage, runVersionIdentity } = useChat({
  agentId: 'support-agent',
  versions: { self: { label: 'candidate' } },
});

sendMessage({ message: 'Check this candidate.' });
```

`runVersionIdentity` reports the requested selector and the immutable versions selected by the server. Tool approvals and other continuations keep their original selection even after a label moves.
