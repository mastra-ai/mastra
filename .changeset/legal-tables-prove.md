---
'@mastra/core': patch
---

Fixed consecutive tool-only turns being incorrectly merged into a single turn. When an agent performed two separate tool calls in different LLM steps (e.g., Tool A in Step 1, Tool B in Step 2), they were merged into one assistant message, making the agent falsely assume it ran them in parallel. Tool calls from different steps are now kept as separate messages, while tool result updates for existing calls still merge correctly. Fixes #14124.
