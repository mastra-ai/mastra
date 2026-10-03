---
'@mastra/core': minor
---

Added support for several processes sharing one notification store, where only some of them can run a given thread.

`dispatchDueNotifications` accepts a `resourceId` to dispatch only that resource's due notifications. A delivery policy can return `hold: true` to leave a due notification pending for another dispatcher, without counting a delivery attempt.

`hold` only applies when a due notification is dispatched. When a notification is first sent, return an action that does not deliver it, such as `defer`:

```ts
import { defaultNotificationDeliveryDecision } from '@mastra/core/notifications';

const agent = new Agent({
  // ...
  notifications: {
    deliveryPolicy: {
      decide: input =>
        canRunHere(input.record.resourceId)
          ? defaultNotificationDeliveryDecision(input)
          : { action: 'defer', deliverAt: input.now, hold: true },
    },
  },
});
```
