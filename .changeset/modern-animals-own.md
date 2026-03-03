---
'@mastra/core': patch
---

Fixed agent-as-tools schema generation so Gemini accepts tool definitions for suspend/resume flows.
This prevents schema validation failures when `resumeData` is present.
