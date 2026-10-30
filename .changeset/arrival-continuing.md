---
'@mastra/playground-ui': minor
---

Added `Continuing` and `Unwatched` to the arrival primitives. `Continuing` moves something the reader already sees into a new place without fading it in, and cancels the fade-in of any arriving element around it. `Unwatched` marks content whose fade-in its parent plays, so nothing inside it fades in on its own. A `Shimmer` inside another `Shimmer` now keeps its own text visible while it moves.

```tsx
import { Continuing, Unwatched } from '@mastra/playground-ui/components/Arrival';

// The run's indicator steps from the tail onto the line that now describes it, without fading in again
<Continuing>
  <ActivityStretchLine members={members} live />
</Continuing>;

// A folded body whose disclosure plays the entrance for everything inside it
<Unwatched>{body}</Unwatched>;
```
