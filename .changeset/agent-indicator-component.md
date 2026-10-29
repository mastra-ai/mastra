---
'@mastra/playground-ui': minor
---

Added `AgentIndicator`, an animated glyph that shows what an agent is doing. It rests as the agent icon and morphs between one pose per kind of work: `idle`, `memory`, `thinking`, `reading`, `searching`, `finding`, `browsing`, `editing`, `running`, `deleting`, `skill`, `tool`, `writing`, `waiting`, `done`, `error`, `context` and `notice`. It draws in `currentColor`, sizes with `className`, and holds still when the user prefers reduced motion. Pass `still` to keep `idle` and `waiting` from breathing when the indicator marks something that is over.

```tsx
import { AgentIndicator, agentGlyph } from '@mastra/playground-ui/components/AgentIndicator';

<AgentIndicator state="running" className="size-4" />;

const RunGlyph = agentGlyph('running');
<RunGlyph className="size-4" />;
```

`agentGlyph(state)` returns any pose as a still, Lucide-compatible icon, drawn from the same frames the indicator morphs through. Tool, signal, skill, reasoning and memory rows now use these glyphs, so a row's icon and the live indicator always show the same shape. `presentTool` returns the call's `pose` next to its `icon`.

`ActivityStretchLine` now wears the indicator in place of its icon. While the stretch runs it takes the pose of the call in progress (a terminal for a command, an eye for a read, a magnifier for a search), then rests as the agent icon once the stretch settles; a stretch that is already settled when it mounts draws the still glyph instead of a live indicator. A live stretch draws before its first row lands, and its new `current` prop (`ActivityCallState[]`) lets the header name the running call while a reveal still holds that row back. Its headline reads in medium weight, and it no longer draws a rule under itself, so consecutive activity lines share one rhythm.

Only a top-level activity line keeps its disclosure chevron visible. Rows nested inside another activity show theirs on hover or keyboard focus.

Added `Continuing` to the arrival primitives: it moves something the reader already sees into a new place without fading it in, and cancels the entrance of any arriving element around it.

`SignalActivity` and `SkillMessage` take `appearance="inline"` to read like the agent's own lines. An inline signal is one line in the same type as a stretch line: its glyph, a readable name (`factory-environment` reads as "Factory environment"), and the mode in plain words. It opens onto the message as prose, line breaks kept and never monospace, and a message short enough to fit stays on the line.
