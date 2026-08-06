---
'@mastra/client-js': patch
---

Added typed display-state fields to the agent-controller `display_state_changed` event: `activeTools`, `toolInputBuffers`, `pendingSuspensions`, `activeSubagents`, and `modifiedFiles` are now declared on the event payload.
