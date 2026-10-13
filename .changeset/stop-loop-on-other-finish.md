---
'@mastra/core': patch
---

Fixed agents re-sending the same request until `maxSteps` when a model step finished with a non-standard reason (such as `other` from OpenAI-compatible servers that omit `finish_reason`) after producing text without tool calls. The run now ends after that step, so the response text and token usage are no longer multiplied.
