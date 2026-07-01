---
'@mastra/core': patch
---

Fixed typing for `AgentConfig.tools` so each tool entry must be a tool object. Functions like `tools: { myTool: () => realTool }` are now rejected at compile time, while setting `tools` itself to a resolver function is still supported. Fixes [#15229](https://github.com/mastra-ai/mastra/issues/15229).
