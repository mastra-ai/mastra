---
'@mastra/datadog': patch
---

Added support for Gemini content format in Datadog input formatting. Gemini messages with {role, parts} are now normalized to {role, content} instead of being stringified.
