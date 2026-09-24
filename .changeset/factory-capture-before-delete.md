---
'@mastra/factory': patch
---

Filesystem snapshots are no longer lost with "No active thread on this session" when a session is deleted right after a turn. Deleting a Factory session now waits up to 10 seconds for the last turn's snapshot to finish before tearing the session down; a snapshot that takes longer can still be skipped.

`waitForPendingFilesystemCapture` is now exported so custom hosts can do the same:

```ts
import { waitForPendingFilesystemCapture } from '@mastra/factory';

await waitForPendingFilesystemCapture(resourceId);
await controller.deleteSession({ resourceId });
```
