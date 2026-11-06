---
'@mastra/server': patch
---

Fixed custom API routes such as `chatRoute` so a client disconnect stops the agent run and its model request. After garbage collection, the disconnect could stop reaching the run (seen on Node.js 22 and 24), so the model request kept running after the client was gone. Fixes [#29154](https://github.com/mastra-ai/mastra/issues/29154).
