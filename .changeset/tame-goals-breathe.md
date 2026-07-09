---
'@mastra/core': patch
---

Extract text from DB-shaped user messages in goal judge prompts instead of stringifying them as `[object Object]`. Goal judge prompts now also skip malformed, empty, or synthetic reminder messages when selecting the latest user context.
