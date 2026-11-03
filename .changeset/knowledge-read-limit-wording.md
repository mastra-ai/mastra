---
'@mastra/core': patch
---

The `knowledge_read` tool now tells the model that a read from a line runs until the page ends or the read's token cap is reached, and that `limit` caps notes, children and mentioning notes, not lines. Models had been passing `limit` expecting a set number of lines back.
