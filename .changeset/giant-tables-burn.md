---
'@mastra/client-js': patch
---

Fixed the types of `agent.generateLegacy()` results. With `output`, `result.object` now has the type of your schema. With `experimental_output`, `result.text` is available again. Fixes #29604.
