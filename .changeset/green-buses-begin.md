---
'@mastra/server': patch
'@mastra/client-js': patch
---

Fix A2A streaming to emit incremental artifact updates from the agent full stream while preserving final structured output artifacts.

Remove incorrect deprecation markers from `getTask()` and `cancelTask()` in the Mastra A2A client.
