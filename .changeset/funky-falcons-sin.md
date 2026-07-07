---
'@mastra/core': patch
---

Fixed durable agent tool error recovery to always continue the agentic loop when tool errors occur, matching the regular agent's behavior. This allows the model to self-correct after tool failures instead of stopping the loop prematurely.
