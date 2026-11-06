---
'@mastra/server': patch
---

Fixed PATCH with `autoPublish: true` on a stored agent updating the active version but leaving the agent's status as `draft`. It now sets the status to `published`, the same as creating an agent with auto-publish.
