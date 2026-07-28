---
'@mastra/core': patch
---

Notifications now stop retrying after a delivery failure that will never succeed.

A notification whose delivery deterministically fails — a missing model, a rejected request context — used to be retried on every dispatch tick forever, because a failed delivery only incremented a counter and left the record `pending`. One production notification reached 288 delivery attempts against the same error.

Delivery attempts are now capped. After 5 failures the notification is marked `failed` and is no longer picked up by the dispatcher:

```ts
const [notification] = await storage.listNotifications({ threadId, status: 'failed' });

notification.deliveryAttempts; // 5
notification.lastDeliveryError; // 'No model selected. Use /models to select a model first.'
```

`failed` is a new `NotificationStatus`, so notification inbox queries can filter for delivery failures that need attention. Transient failures are unaffected — they still retry, just no longer without bound.
