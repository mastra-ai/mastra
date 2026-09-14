---
'@mastra/core': minor
---

Add `NotificationsStorage.markNotificationDelivered()` and use it in the notification dispatcher so a notification the agent marks seen, dismissed, or archived while its signal is in flight is no longer overwritten back to `delivered`. The method always records `deliveredSignalId` and `lastDeliveryAttemptAt` but only promotes `status` when it is still `pending`.

```ts
const record = await storage.markNotificationDelivered({
  threadId,
  id,
  deliveredSignalId: signal.id,
  lastDeliveryAttemptAt: new Date(),
});
// record.status is 'delivered' if it was pending, otherwise unchanged (e.g. 'seen'); null if missing
```

Custom `NotificationsStorage` implementations inherit a read-then-write default; override it with a single conditional write to close the race entirely.
