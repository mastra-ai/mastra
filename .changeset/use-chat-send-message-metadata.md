---
'@mastra/react': patch
---

Added an optional `metadata` argument to `useChat().sendMessage`, so you can tag the user message (for example to render app-sent messages differently).

```tsx
await sendMessage({ message: 'Sync workspace', threadId, metadata: { source: 'workspace-sync' } });
```

The metadata is set on the optimistic message's `content.metadata` and kept when the server echo reconciles it. With `enableThreadSignals`, it is also sent with the outgoing message. The internal `mode`, `status`, and `clientMessageId` keys always override values with the same name.
