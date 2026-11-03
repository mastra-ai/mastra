---
"@mastra/core": minor
---

Add optional context mode, timestamp, and response identity fields to HTTP feedback/score types. Preserve an explicit null feedback author in storage without substituting the span user; omitted legacy storage attribution remains supported.
