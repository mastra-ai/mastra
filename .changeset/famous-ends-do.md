---
'@mastra/inngest': patch
---

Fixed sub-agents that stopped streaming after an Inngest durable agent run was resumed with a `requestContext` and `closeOnSuspend`. Fixes [#29436](https://github.com/mastra-ai/mastra/issues/29436).
