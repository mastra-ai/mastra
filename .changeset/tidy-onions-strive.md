---
'@mastra/playground-ui': minor
---

Added a pointer-aware ring around the chat composer. At rest it is a plain border; on hover or focus a soft arc lights the edge under the cursor, and while the agent is running the arc rotates on its own so the composer itself shows the run instead of a separate "working…" label.

```tsx
import { ComposerBox, ComposerRing } from '@mastra/playground-ui/components/Composer';

<ComposerRing busy={isRunning}>
  <ComposerBox>{/* input and actions */}</ComposerBox>
</ComposerRing>;
```

Wrap `ComposerBox` with it and pass `busy` — the ring becomes the composer's edge, so the box no longer needs a border of its own.
