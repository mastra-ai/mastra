---
'@mastra/playground-ui': minor
---

Added `AgentIndicator`, an animated glyph that shows what an agent is doing. It rests as the agent icon and morphs between nine states: `idle`, `memory`, `thinking`, `searching`, `tool`, `writing`, `waiting`, `done` and `error`. It draws in `currentColor`, sizes with `className`, and holds still when the user prefers reduced motion.

```tsx
import { AgentIndicator } from '@mastra/playground-ui/components/AgentIndicator';

<AgentIndicator state="thinking" className="size-4" />;
```
