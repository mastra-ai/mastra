---
'@internal/playground': patch
---

Fixed the Prompt Blocks page and the "Select a prompt block" dialog in Studio silently showing only the first 100 prompt blocks. Both now paginate (50 per page) with Previous/Next controls, so every stored prompt block is reachable again. Fixes [#20456](https://github.com/mastra-ai/mastra/issues/20456).
