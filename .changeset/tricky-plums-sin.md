---
'@mastra/core': patch
---

Fixed durable agent runs being reported as lost after they suspend, which left the following `resume()` streaming nothing and never finishing. This happened when a lease renewal sent just before the suspension reached storage after the run had already released its claim, most often with storage whose new connections are slow to open. Evented agent runs on a shared transport, such as Redis or a socket broker, were affected the same way, including when the worker that released the claim runs in a different process from the API. A late renewal is now ignored when the run's own release made it fail, and `resume()` streams to its finish. A renewal rejected because another execution took the run over still stops the run. Fixes [#30206](https://github.com/mastra-ai/mastra/issues/30206).

Custom lease providers can now set `atomicTransfer: true` on `LeaseProvider` when their `transferLease` checks the current owner and hands the lease over in one step. The built-in in-memory, Unix socket, Redis and Valkey providers set it. A provider that leaves it unset keeps the earlier behaviour: a renewal that fails after the run released its claim still stops the run.

```ts
const leases: LeaseProvider = {
  // ...acquireLease, getLeaseOwner, releaseLease, renewLease, transferLease
  atomicTransfer: true,
};
```
