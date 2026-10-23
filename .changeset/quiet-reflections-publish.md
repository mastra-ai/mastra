---
'@mastra/memory': patch
---

Fixed buffered reflection values appearing in thread metadata before activation. Pending values survive reloads and are discarded when their buffer is superseded. Fixes [#27262](https://github.com/mastra-ai/mastra/issues/27262).
