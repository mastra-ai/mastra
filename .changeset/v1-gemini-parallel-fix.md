---
"@mastra/core": patch
---

Fixes parallel tool call issue with Gemini 3 Pro by preventing step-start parts from being inserted between consecutive tool parts in the `addStartStepPartsForAIV5` function. This ensures that the AI SDK's `convertToModelMessages` correctly preserves the order of parallel tool calls and maintains the `thought_signature` on the first tool call as required by Gemini's API.