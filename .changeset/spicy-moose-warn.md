---
'@mastra/core': patch
---

Fixed provider error classification for OpenAI billing limits. A 429 with `credit_balance_exhausted`, `organization_spend_limit_exceeded`, `project_spend_limit_exceeded` or `organization_usage_limit_exceeded` is now classified as `quota` instead of `rate_limited`, so callers no longer wait for credits that will not come back.

Gemini per-minute limits are now classified as `rate_limited` instead of `quota`. Their 429 says "You exceeded your current quota" but also "Please retry in 41.97s", so callers wait and retry instead of giving up. Daily, weekly and monthly quotas stay `quota`, even when they come with a short retry hint, and so does any retry hint longer than an hour.
