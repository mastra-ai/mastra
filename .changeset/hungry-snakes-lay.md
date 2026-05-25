---
'@mastra/core': minor
'mastracode': patch
---

Added signal delivery option attributes API that conditionally merges branch `attributes` based on whether a signal is delivered to an active agent run (`ifActive.attributes`) or an idle run (`ifIdle.attributes`). This enables contextual signal delivery — for example, tagging user messages as `while-active` when the agent is actively working.
