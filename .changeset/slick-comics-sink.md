---
'@mastra/server': patch
---

Fixed memory status reporting for agents that do not support Mastra memory. The memory status endpoint now preserves storage fallback for regular agents while allowing integrations to opt out of memory UI.
