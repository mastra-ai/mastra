---
'@mastra/inngest': patch
---

Inngest agents now include the run's tool calls (`toolCalls`) in the `MODEL_GENERATION` span output, matching regular and core durable agents. Tracing exporters such as PostHog now show which tools an Inngest agent called.
