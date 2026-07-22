---
'@mastra/core': patch
---

Fixed durable agent runs continuing after a tool call was denied by authorization. The run now fails immediately instead of letting the model retry the denied tool.
