---
'@mastra/ai-sdk': patch
'@mastra/core': patch
---

Fixed text accumulation in transformAgent: clear accumulated text on tool-call chunks and reset per-step state (text, toolCalls, toolResults, reasoning, sources, files) on step-finish to prevent tool-result JSON from leaking across steps. Fixes https://github.com/mastra-ai/mastra/issues/13268
