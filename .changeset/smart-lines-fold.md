---
'@mastra/memory': patch
---

Fixed observational memory retrying a model call through its whole retry budget (nine attempts and about four minutes of back-off by default) when the provider account has no credits or quota left. OpenAI reports this with HTTP 429, the same status as a rate limit, so it was retried as if it would clear on its own. Observational memory now uses the same provider-error classification as the agent loop: an exhausted account fails on the first attempt, and its unobserved messages are observed on a later turn once the account works again. Rate limits, including Gemini's per-minute and retry-in-seconds quota errors, are still retried.
