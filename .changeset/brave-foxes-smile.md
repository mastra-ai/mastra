---
'@mastra/core': patch
---

Fix parallel tool call handling for Gemini models

- Fix addStartStepPartsForAIV5 to prevent step-start parts from being inserted between consecutive tool parts (parallel tool calls)
- This ensures parallel tool calls maintain correct order and preserve thought_signature metadata on the first tool call as required by Gemini API
