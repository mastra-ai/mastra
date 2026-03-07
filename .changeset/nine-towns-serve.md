---
'@mastra/core': patch
---

Fixed leaked tool-result JSON in streamed text during multi-step agent runs.

Tool-call data no longer appears in text-delta output for intermediate steps. This prevents raw tool payloads from being shown to users or saved in assistant text messages. Fixes https://github.com/mastra-ai/mastra/issues/13268
