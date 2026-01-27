---
'@mastra/core': patch
---

Improve autoresume prompt sent to LLM to ensure gemini resumes well.
Gemini sometimes doesn't use the previous messages to create inputData for the tool to resume, the prompt was updated to make sure it gets the inputData from the suspended tool call.
