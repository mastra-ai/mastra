---
'@mastra/core': patch
---

Fixed 'promise text was not resolved or rejected when stream finished' error that occurred when the LLM returned output that didn't match the expected structured output schema. The inner stream's text promise was incorrectly left unresolved for LLM execution steps, causing unhandled promise rejections.
