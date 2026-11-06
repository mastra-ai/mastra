---
'@mastra/client-js': patch
---

Fixed `agent.generateLegacy()` in the client SDK typing `result.object` as `never` when called with `output`, and dropping `text` when called with `experimental_output`. Both results are now typed from the schema you pass. Fixes #29604.
