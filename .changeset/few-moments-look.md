---
'@mastra/factory': minor
'create-factory': patch
---

Added a Jira Cloud intake integration for the Software Factory. Set JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN to select Jira projects as intake sources in Settings, route each selected project to a Factory, and browse its active issues on that Factory's board. Agents get a read-only jira_get_issue tool for full issue context. Credentials are deployment-global (an Atlassian API token) — no OAuth app setup needed, intended for self-hosted/single-tenant deployments.
