---
'@mastra/core': patch
---

Exported `readNotificationRoutingRequirement` from `@mastra/core/notifications`, so a notification delivery policy can tell whether a notification was routed to the thread's claimed owner.

```ts
import { readNotificationRoutingRequirement } from '@mastra/core/notifications';

const routedToOwner = readNotificationRoutingRequirement(record.metadata)?.requireClaimedOwner === true;
```
