---
'@mastra/inngest': patch
---

Fixed Inngest agent traces so tracing exporters such as PostHog show every tool called during a run. The `MODEL_GENERATION` span output now includes the run's `toolCalls`.
