---
'@mastra/factory': patch
---

Fixed GitHub events losing their rule decisions when a work item changed while its Factory rule was running. The rule now runs again against the latest work item. If the item keeps changing, the stale evaluation is not saved and the webhook responds with 503, so redelivering the event evaluates it again instead of replaying an empty result. See https://github.com/mastra-ai/mastra/issues/25884.
