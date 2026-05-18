---
'@mastra/core': patch
---

Merge auto-resume and background overrides into Mastra tools via JSON Schema instead of Zod `.extend()` with Mastra's Zod v4 shim, fixing Zod 3/v4 mismatches (`_parse` errors), working-memory tools, and Google/Gemini tool schema conversion (`toJSONSchema` optional failures).
