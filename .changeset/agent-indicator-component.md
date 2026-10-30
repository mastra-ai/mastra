---
'@mastra/playground-ui': minor
---

Added `AgentIndicator`, an animated glyph that shows what an agent is doing. It rests as the agent icon and morphs between one pose per kind of work: `idle`, `memory`, `thinking`, `reading`, `searching`, `finding`, `browsing`, `editing`, `running`, `deleting`, `skill`, `tool`, `waiting`, `done`, `error`, `context` and `notice`. It draws in `currentColor`, sizes with `className`, and holds still when the user prefers reduced motion. Pass `still` to keep `idle` and `waiting` from breathing when the indicator marks something that is over.

```tsx
import { AgentIndicator, agentGlyph } from '@mastra/playground-ui/components/AgentIndicator';

<AgentIndicator state="running" className="size-4" />;

const RunGlyph = agentGlyph('running');
<RunGlyph className="size-4" />;
```

`agentGlyph(state)` returns any pose as a still, Lucide-compatible icon, drawn from the same frames the indicator morphs through. Tool, signal, skill, reasoning and memory rows now use these glyphs, so a row's icon and the live indicator always show the same shape. `presentTool` returns the call's `pose` next to its `icon`.
