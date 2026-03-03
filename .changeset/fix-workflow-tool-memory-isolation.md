---
'@mastra/core': patch
---

Fixed an issue where sub-agent messages inside a workflow tool would corrupt the parent agent's memory context. When an agent calls a workflow as a tool and the workflow runs sub-agents with their own memory threads, the parent's thread identity on the shared request context is now correctly saved before the workflow executes and restored afterward, preventing messages from being written to the wrong thread.
