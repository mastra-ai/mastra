---
'@mastra/playground-ui': minor
---

`MessageTimestamp` now says how long ago a message was sent ("just now", "7 minutes ago", "yesterday") and keeps that label current. Hovering or focusing it shows the full date and time, such as "Nov 3, 2026, 10:24 PM".

Tool call lines no longer show when they started on hover, so the time appears only in the message's action bar. Removed `ActivityTimedTrigger` from `@mastra/playground-ui/domains/chat/activity`; use `ActivityTrigger` instead. `ActivityCall` and `ActivityCallState` no longer take `startedAt`.

**Before**

```tsx
import { ActivityTimedTrigger } from '@mastra/playground-ui/domains/chat/activity';

<ActivityTimedTrigger at={startedAt}>{headline}</ActivityTimedTrigger>;
```

**After**

```tsx
import { ActivityTrigger } from '@mastra/playground-ui/components/ai/activity';

<ActivityTrigger>{headline}</ActivityTrigger>;
```
