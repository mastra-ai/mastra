---
'@mastra/core': patch
---

Fixed `declineToolCall` and `declineToolCallGenerate` so declined approval-gated tools no longer execute or cause side effects after resume. Fixes https://github.com/mastra-ai/mastra/issues/20470
