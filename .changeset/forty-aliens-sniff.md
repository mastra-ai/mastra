---
'@mastra/factory': patch
---

Fixed GitHub rule decisions being lost when a work item changes while its Factory rule is running.

- Factory re-reads the work item and runs the rule again, up to three evaluations in total.
- If the item is still changing after the third evaluation, no rule result or decisions are saved and the webhook responds with HTTP 503. GitHub does not redeliver failed webhooks automatically; redelivering the event (manually or from your GitHub App) evaluates it again instead of replaying an empty result.
- GitLab, Jira, Linear, and incident.io rules keep their existing behavior.

See https://github.com/mastra-ai/mastra/issues/25884.
