---
'@mastra/factory': patch
---

Fixed three Jira intake routing problems when factories share a Jira project:

- Deleting a factory now releases the Jira projects routed to it, so another factory can take all their issues, including issues the deleted factory had already filed. Routes left behind by factories deleted earlier can now be removed in Settings.
- A filed Jira card keeps loading its description after another factory's label filter starts taking its issue, or after the issue is relabelled.
- Label filters now reject labels containing spaces, which Jira labels cannot have.
