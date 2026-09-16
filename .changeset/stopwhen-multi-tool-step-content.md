---
'@mastra/core': patch
---

Fix `stopWhen` receiving a step with empty `content`/`toolResults` (while `toolCalls` stayed populated) when the last step of a multi-turn agent loop makes multiple tool calls. The agentic loop now re-extracts the current step's content from the completed message list via `modelContent` instead of trusting a pre-flush snapshot slice, so `content`, `toolResults`, `staticToolResults`, and `dynamicToolResults` are fully populated for multi-tool steps — matching the fix already applied to input-step processors. Durable agents fall back to the sliced content when re-extraction returns empty.
