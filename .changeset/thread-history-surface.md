---
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/react': minor
'@mastra/core': patch
---

Added `withInitialHistory` to thread subscriptions over HTTP. Pass it to `subscribeToThread` in `@mastra/client-js`, or to `useChat` in `@mastra/react`, to get stored thread messages as one `thread-history` chunk before live parts. Completed runs no longer replay on reconnect.

```ts
const subscription = await agent.subscribeToThread({ threadId, resourceId, withInitialHistory: { perPage: 40 } });
```

```tsx
const chat = useChat({ agentId, threadId, resourceId, enableThreadSignals: true, withInitialHistory: true });
```

Agent controller tool-approval requests now resume the stored suspended run when no approval is waiting in the session, so approval cards restored from thread history after a restart can be answered.
