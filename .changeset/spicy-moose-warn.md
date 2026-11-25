---
'@mastra/core': minor
---

Fixed provider error classification for OpenAI billing limits. A 429 with `credit_balance_exhausted`, `organization_spend_limit_exceeded`, `project_spend_limit_exceeded` or `organization_usage_limit_exceeded` is now classified as `quota` instead of `rate_limited`, so callers no longer wait for credits that will not come back. This applies to every agent: the built-in stream error retry now fails these OpenAI errors right away instead of retrying them.

Gemini daily, weekly and monthly quotas are now classified as `quota` even when the 429 carries a short retry hint, such as "Please retry in 34s" on a per-day free-tier quota. Before, the hint made them `rate_limited`, so callers retried a quota that had not refilled. Per-minute limits stay `rate_limited`.

Exported `PROVIDER_FAILURE_KINDS` from `@mastra/core/error`, the list of values `ProviderFailureKind` can take, for validating a stored failure kind at runtime.
