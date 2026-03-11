---
'@mastra/core': patch
---

Fixed agent loop stopping prematurely when LLM returns tool calls with finishReason 'stop'. Some models (e.g., OpenAI gpt-5.3-codex) return 'stop' even when tool calls are present, causing the agent to halt instead of processing tool results and continuing. The agent now correctly continues the loop whenever tool calls exist, regardless of finishReason.
