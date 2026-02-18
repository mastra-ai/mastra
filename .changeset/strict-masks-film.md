---
'@mastra/core': patch
---

Fixed unhandled promise rejections that crashed the process and hid the real error when LLM output did not match the expected structured output schema. Users now see the actual schema validation failure instead of a misleading "promise was not resolved or rejected when stream finished" error.
