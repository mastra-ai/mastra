---
'@mastra/memory': patch
---

Fixed thread transfers missing observations when search results take time to reflect updates. Incomplete transfers now report an error so callers can retry. Fixes [#27834](https://github.com/mastra-ai/mastra/issues/27834).
