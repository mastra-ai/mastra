---
'@mastra/core': patch
---

Fixed OpenAI tool strict mode when requests pass through the model router. `strict: true` on function tools now survives compatibility prep, so OpenAI Responses models receive strict tool definitions instead of silently downgrading them to non-strict.
