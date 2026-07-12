---
'@mastra/core': patch
---

Fixed `Memory` `generateTitle` never firing for durable agents (`createEventedAgent` and Inngest). The durable finish step (`create-durable-agentic-workflow.ts`) ported only the message-persistence half of the non-durable `#executeOnFinish`, omitting the title-generation branch, so the thread `title` stayed `null` on the durable path even with `generateTitle` configured. Title generation is now run in the durable finish step, resolving the title helpers from the agent instance, and is kept outside the `!observationalMemory` guard so it also runs when Observational Memory is enabled.
