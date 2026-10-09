---
'@mastra/posthog': patch
---

Fixed `$ai_input` in PostHog missing the results of provider-executed tools (for example a provider's web search). Each later call's `$ai_input` now includes those results, and failed ones are marked as errors.
