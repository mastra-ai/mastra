---
'@mastra/core': patch
---

Fixed runs being aborted when their thread lease lapsed only because their process fell behind. Under heavy load a renewal can go out after the lease ran out, or none can be confirmed before the lease's deadline. The run now takes the lease back instead of being aborted. It is still aborted when another run holds the thread, or when the lease backend doesn't answer within one renewal interval.

Added a reason to runs stopped because another run took their thread lease. The `abort` chunk carries `payload.reason: 'thread-lease-lost'`, and a session's `agent_end` event carries `abortReason: 'thread-lease-lost'`:

```ts
session.subscribe(event => {
  if (event.type === 'agent_end' && event.reason === 'aborted' && event.abortReason === 'thread-lease-lost') {
    console.log('Another run took over this thread.');
  }
});
```
