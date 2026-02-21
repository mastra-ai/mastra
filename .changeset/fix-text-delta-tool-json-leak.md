---
'@mastra/core': patch
---

Fixed tool result JSON leaking into text-delta stream events when models emit text alongside tool calls. Some models (e.g. gpt-oss-120b via OpenRouter) include raw JSON of tool results as text content in intermediate tool-call steps. This text was previously streamed to the client as text-delta events, causing garbage JSON to appear in the UI.

Text chunks are now buffered per step and only flushed to the stream if the step does not contain tool calls. Provider-executed tool calls (e.g. Claude Code SDK tools) are excluded from this suppression, preserving their legitimate text output.
