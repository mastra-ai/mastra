---
'@mastra/mcp': patch
---

**Fixed spurious MCP reconnects when tool-execution errors contain transport-like substrings.**

When an MCP tool returns an in-band error (\`isError: true\`) whose text contains words like "session", "404", or "connection closed", the client no longer misclassifies it as a transport failure and triggers a reconnect + retry. This prevents duplicate calls for non-idempotent tools (e.g. payments, writes).

**Surface the real failure after a failed reconnect.**

When a transport-level reconnect fails, the caller now receives the actual reconnection error instead of the stale tool/transport error that triggered the recovery attempt.
