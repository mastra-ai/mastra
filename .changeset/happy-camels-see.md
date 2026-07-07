---
'@mastra/core': patch
---

Fixed durable agent abortSignal forwarding and handling. The abort signal is now correctly passed to both LLM execution and tool execution steps, and the workflow stops cleanly with a proper 'abort' finish reason instead of crashing. Also fixed sendMessage-wake flow for durable agents by registering runs with AgentThreadStreamRuntime, enabling subscribeToThread and sendMessage to work correctly.
