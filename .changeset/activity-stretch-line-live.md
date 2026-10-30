---
'@mastra/playground-ui': minor
---

`ActivityStretchLine` now shows the `AgentIndicator` in place of its icon. While its tool calls run, the indicator takes the shape of the call in progress (a terminal for a command, an eye for a read, a magnifier for a search), then rests as the agent icon once they finish. A line that is already finished when it mounts draws a still icon instead.

A live line draws before its first row lands. Its new `current` prop (`ActivityCallState[]`) lets the line name the running call while that call's row is still held back. The line reads in medium weight and no longer draws a rule under itself, so consecutive activity lines keep one rhythm.

A live line writes its first words in from the left. When what it says changes, the old words roll up and blur away while the new ones roll into place, and the line glides to its new width. A line that is already finished when it mounts never moves, and opening one shows its rows without fading them in. Words too long for the line fade out at its right edge instead of ending in an ellipsis.

Only a top-level activity line keeps its disclosure chevron visible. Rows nested inside another activity show theirs on hover or keyboard focus, and take no room until then.
