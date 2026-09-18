---
'@mastra/factory': minor
'create-factory': minor
---

Added a Jira Cloud intake integration for the Software Factory with full Linear-equivalent behavior, supporting both direct credentials and Platform-managed connections.

Direct mode: set `JIRA_BASE_URL`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` to use a deployment-global Atlassian API token — no OAuth app setup, intended for self-hosted/single-tenant deployments. Platform mode: with `MASTRA_PLATFORM_ACCESS_TOKEN` or `MASTRA_PLATFORM_SECRET_KEY` configured, Factory automatically discovers visible Platform Jira connections (multiple sites supported) and proxies Jira requests through the Platform integrations service; an explicitly configured `JiraIntegration` takes precedence.

Factory settings and onboarding connect Jira accounts in-app, select Jira projects as intake sources, and route each project to a Factory board. Observed issues on routed projects materialize automatically as work items, closed issues transition their linked card to done or canceled, and both Jira integrations accept `rules` overrides for the `issueObserved` and `issueClosed` events. A background reconciliation worker keeps imported work items fresh (`MASTRACODE_JIRA_RECONCILE_ENABLED`, `MASTRACODE_JIRA_RECONCILE_INTERVAL_MS`). Work cards preserve Jira descriptions, labels, reporters, assignees, priority, project, site, state, and timestamps, appear in the board's teammate filters, and offer the same investigate and build actions as Linear issues. Agents get `jira_get_issue` and `jira_create_comment` tools, including on automated board runs.
