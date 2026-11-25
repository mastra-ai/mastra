---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed token usage and cost tracking when a durable agent run suspends for a tool approval or a suspending tool. The suspended part now records the tokens of the model calls it made, and the resumed part records only its own, so each model call is counted once on `createDurableAgent`, `createEventedAgent` and `createInngestAgent`.
