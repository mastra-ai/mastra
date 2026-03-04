---
'@mastra/ai-sdk': patch
'@mastra/core': patch
---

Fixed tool result JSON leaking into text-delta SSE events during multi-step agent execution. Some models (e.g. gpt-oss-120b via OpenRouter) echo tool-result JSON as text content in intermediate steps. Text-delta chunks are now buffered and discarded when the step ends with tool calls, preventing leaked JSON from reaching the client stream or being persisted to the message list. Fixes https://github.com/mastra-ai/mastra/issues/13268
