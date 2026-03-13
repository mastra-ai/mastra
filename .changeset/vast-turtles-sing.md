---
'@mastra/core': patch
---

Fixed tryRepairJson to handle unquoted date values (e.g. 2026-04-15) in tool call arguments. LLMs like Claude Sonnet sometimes produce bare date values without quotes, causing JSON.parse to fail and tool calls to silently lose all arguments. The repair function now detects and quotes date-like values matching YYYY-MM-DD and YYYY-MM-DDTHH:MM:SS patterns. See https://github.com/mastra-ai/mastra/issues/14230
