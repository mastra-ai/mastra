---
'@mastra/langsmith': patch
'@mastra/posthog': patch
'@mastra/sentry': patch
---

Fixed how LangSmith, PostHog, and Sentry handle the usage-only model spans that `@mastra/observability` exports for hidden model calls, such as `structuredOutput` with a separate `model`. LangSmith counts their tokens once, PostHog sends them without the agent's conversation, and Sentry keeps the agent's own model call on the agent span.
