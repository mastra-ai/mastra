---
'@mastra/core': patch
---

Fixed agents stopping after a tool whose `execute` returns nothing. A server tool that returned `undefined` was treated like a client tool waiting for a result, so the agent ended the turn without a final answer, the tool call stayed in `input-available`, and the call was left out of the next turn's history, which could make the model run the tool again. Such tools now record a `null` result and the agent continues as usual.
