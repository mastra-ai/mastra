---
'@mastra/posthog': patch
---

Fixed PostHog group analytics not being populated for AI events. Events that include `metadata.$groups` are now correctly attached to their PostHog groups, so you can slice LLM analytics such as cost by group.
