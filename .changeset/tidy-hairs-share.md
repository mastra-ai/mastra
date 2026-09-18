---
'create-factory': minor
'@mastra/factory': minor
---

Added complete Platform-managed Jira intake. Factory settings and onboarding now connect accounts in-app, support multiple sites, route a selected Jira project to a Factory board, reconcile imported work items in the background, preserve Jira descriptions, labels, reporters, assignees, priority, project, site, state, and timestamps on work cards, show Jira assignees directly on filed cards, and provide the same investigate and build actions as Linear issues. Jira now matches Linear's Factory behavior end to end: observed issues on routed projects materialize automatically as work items, closed issues transition their linked card to done or canceled, both Jira integrations accept `rules` overrides for the `issueObserved` and `issueClosed` events, and agents can post Jira comments with `jira_create_comment`.
