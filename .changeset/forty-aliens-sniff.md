---
'@mastra/factory': patch
---

Fixed GitHub events being lost when a work item changed while its Factory rule was running. The event is now evaluated again against the latest work item. If the item keeps changing, the webhook responds with 503 and stores nothing, so redelivering the event evaluates it fresh instead of replaying an empty result. See https://github.com/mastra-ai/mastra/issues/25884.
