---
'@mastra/react': minor
---

Add canonical agent version selectors and expose trusted resolved run identity from `useChat`.

```tsx
const { sendMessage, runVersionIdentity } = useChat({
  agentId: 'support-agent',
  versions: {
    self: { label: 'candidate' },
  },
})

sendMessage({ message: 'Check this candidate.' })
```

`runVersionIdentity` preserves the requested selector and reports the immutable version selected by the server for
that run.
