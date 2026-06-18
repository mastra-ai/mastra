---
'@mastra/core': patch
---

Fixed suspended tool resumes so subscribed thread streams continue receiving the resumed response instead of falling back to a separate direct stream reader.
