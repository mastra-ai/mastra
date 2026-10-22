---
'@mastra/playground-ui': minor
---

Added `RotatingText`, a styleless component that shows a list of messages one at a time in random order. Use it to show what a long-running task is busy with, for example in an empty state.

```tsx
import { RotatingText } from '@mastra/playground-ui/components/RotatingText';

<EmptyState
  titleSlot="Experiment in progress"
  descriptionSlot={<RotatingText messages={['Calling your target…', 'Consulting the scorers…']} />}
/>
```
