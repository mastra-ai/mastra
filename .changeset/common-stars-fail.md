---
'@mastra/react': patch
---

Apply tool display transforms when accumulating agent stream chunks, including masked arguments and results, suppressed input deltas, and approval or suspension prompts.

Preserve the server's assistant message ID when a user signal arrives before the first step, so streamed responses match their persisted history.
