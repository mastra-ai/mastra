---
'@mastra/core': patch
---

Fixed extra model step and model inference spans in traces when `onStepFinish` takes time to finish. Each model call now has one step span and one inference span with its own token usage, so exporters such as PostHog and Langfuse no longer count a model call twice.
