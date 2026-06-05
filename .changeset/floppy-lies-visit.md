---
'@mastra/posthog': patch
---

Fixed PostHog group analytics not being populated for AI events. When a span includes `metadata.$groups`, the exporter now passes those values as the top-level `groups` field on the PostHog capture call, so events are correctly attached to PostHog groups (e.g. for slicing LLM cost analytics by group). Previously the values were only copied into event properties, where the PostHog Node SDK discarded them.
