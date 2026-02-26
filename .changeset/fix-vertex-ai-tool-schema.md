---
'@mastra/core': patch
---

Fix Vertex AI 400 errors when using agent or workflow tools with Google Vertex AI models. The auto-injected `suspendedToolRunId` and `resumeData` fields now produce schemas compatible with Vertex AI's strict validation.
