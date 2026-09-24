---
'@mastra/factory': patch
---

Fixed filesystem snapshots being dropped with "No active thread on this session" when a session is deleted right after a turn. The queued capture now uses the thread read when the turn ended, and Factory's session DELETE routes wait for it before tearing the session down.

`waitForPendingFilesystemCapture` is now exported so custom hosts can do the same:

```ts
import { waitForPendingFilesystemCapture } from '@mastra/factory';

await waitForPendingFilesystemCapture(resourceId);
await controller.deleteSession({ resourceId });
```
