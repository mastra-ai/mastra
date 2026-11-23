---
'@mastra/memory': patch
---

Fixed observational memory retrying a model call through its whole retry budget (nine attempts and about four minutes of back-off by default) when the OpenAI account has no credits or quota left. OpenAI reports this with HTTP 429, the same status as a rate limit, so it was retried as if it would clear on its own. It now fails on the first attempt; rate limits, including Gemini's per-minute quota errors, are still retried.
