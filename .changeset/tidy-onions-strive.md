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

The ring must wrap the box rather than decorate it: `ComposerBox` clips its overflow and would cut the arc off.
