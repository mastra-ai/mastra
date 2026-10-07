---
'@mastra/core': patch
---

Fixed duplicated assistant messages after a suspended tool or sub-agent call resumes. Each earlier reply and tool call now appears only once in saved conversation history. Fixes #26150.
