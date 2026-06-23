---
'@mastra/playground-ui': patch
---

Removed `ScrollableContainer`. Use `ScrollArea` with the `scrollButtons` prop for horizontal scroll controls.

**Before**

```tsx
import { ScrollableContainer } from '@mastra/playground-ui';

<ScrollableContainer>{items}</ScrollableContainer>;
```

**After**

```tsx
import { ScrollArea } from '@mastra/playground-ui';

<ScrollArea orientation="horizontal" scrollButtons>
  {items}
</ScrollArea>;
```
