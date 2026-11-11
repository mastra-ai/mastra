---
'@mastra/core': patch
'@mastra/memory': patch
---

User messages are stored as written. Before a message reaches the model, turn tags are escaped unless the message was built with `asUserTurn`, which keeps its one outer tag and escapes any further turn tags inside the text.
