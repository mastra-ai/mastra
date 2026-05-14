---
'@internal/playground': patch
---

Fixed Studio rendering for A2A subagent calls while they are in progress and after remote results return inline text.

Agent badges now handle missing tool results during the first render, and remote subagent text is shown without fetching a local subagent memory thread that may not exist.
