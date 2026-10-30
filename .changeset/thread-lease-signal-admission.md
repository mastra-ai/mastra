---
'@mastra/core': patch
---

Fixed lost signals when sending to a thread whose Redis lease is still held by a run that has already finished. The signal is now reported as delivered only after the lease holder confirms it was accepted. Otherwise Mastra retries taking the lease, or rejects with a typed error instead of silently dropping the signal.

The error is a `MastraError` with id `AGENT_THREAD_OWNER_DID_NOT_ACCEPT_SIGNAL` (exported as `THREAD_OWNER_DID_NOT_ACCEPT_SIGNAL_ERROR_ID` from `@mastra/core/agent`). Its `details` carry `threadId`, `resourceId` and `retryable: true`. No run consumed the signal, so you can retry the send:

```ts
import { THREAD_OWNER_DID_NOT_ACCEPT_SIGNAL_ERROR_ID } from '@mastra/core/agent';

try {
  await agent.sendMessage(message, { resourceId, threadId }).accepted;
} catch (error) {
  if (error?.id === THREAD_OWNER_DID_NOT_ACCEPT_SIGNAL_ERROR_ID) {
    // retry the send
  }
}
```
