---
'@mastra/playground-ui': minor
---

Added a reusable `HoverCard` component (`HoverCard`, `HoverCardTrigger`, `HoverCardContent`) built on Base UI. The trace timeline and key-value list hover cards now share this single component instead of inlining the markup, and it is exported for general use.

```tsx
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@mastra/playground-ui';

<HoverCard>
  <HoverCardTrigger>Weather Agent</HoverCardTrigger>
  <HoverCardContent>Answers questions about current conditions and forecasts.</HoverCardContent>
</HoverCard>;
```
