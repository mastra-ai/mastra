---
'@mastra/playground-ui': minor
---

Added a reusable `HoverCard` component (`HoverCard`, `HoverCardTrigger`, `HoverCardContent`) built on Base UI. You can now use these exported components to add hover card interactions anywhere in your UI.

```tsx
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@mastra/playground-ui';

<HoverCard>
  <HoverCardTrigger>Weather Agent</HoverCardTrigger>
  <HoverCardContent>Answers questions about current conditions and forecasts.</HoverCardContent>
</HoverCard>;
```
