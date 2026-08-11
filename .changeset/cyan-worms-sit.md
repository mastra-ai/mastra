---
'@mastra/server': patch
---

Fixed agent-controller display-state events losing their tool state over SSE. The display state's Maps (active tools, streaming tool inputs, pending suspensions, active subagents, modified files) serialized to empty objects on the wire; they now arrive as plain records keyed the same way.
