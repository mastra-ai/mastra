---
'@mastra/core': patch
---

Fixed Anthropic server*tool_use.id validation errors by preemptively rewriting tool-call IDs in the outbound prompt. Provider-executed tools now get deterministic srvtoolu* prefixed IDs, and invalid characters are sanitized for both client and server tool IDs. This runs in processLLMRequest so persisted messages are never mutated.
