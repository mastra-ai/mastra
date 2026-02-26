---
'@mastra/core': patch
---

Fix Vertex AI 400 error caused by auto-injected `suspendedToolRunId` and `resumeData` tool schema fields. Removed `.nullable()` and `.describe()` modifiers that produced `anyOf` alongside `description` in JSON Schema, which Vertex AI rejects.
