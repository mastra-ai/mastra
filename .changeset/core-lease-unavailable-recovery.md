---
'@mastra/core': patch
---

Fixed evented agent runs staying in `running` forever when the lease backend restarted while a tool was finishing. The execution that still owns the run now takes back a thread lease that expired during the restart, and the run no longer aborts as if it lost its lease while the backend is refusing every client.

Custom `LeaseProvider` implementations can add the optional `isUnavailableToAll(error)` method to report errors where the backend refuses every client, so no other owner can be granted the lease meanwhile. Return `false` for any other error, including connection failures that may affect only this caller.

```ts
import type { LeaseProvider } from '@mastra/core/events';

const leaseProvider: LeaseProvider = {
  // ...acquireLease, getLeaseOwner, releaseLease, renewLease, transferLease
  isUnavailableToAll: error => error instanceof Error && error.message.startsWith('LOADING'),
};
```
