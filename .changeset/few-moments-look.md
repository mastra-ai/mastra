---
'@mastra/factory': minor
'create-factory': patch
---

Added Jira Cloud as an intake source for the Software Factory.

- Select Jira projects in **Settings → Intake**, route them to a Factory, and browse active issues on its board.
- Give agents full issue context through the read-only `jira_get_issue` tool.
- Configure one deployment-global Atlassian API token; no OAuth app is required. This model is intended for self-hosted, single-tenant deployments.

```dotenv
JIRA_BASE_URL=https://acme.atlassian.net
JIRA_EMAIL=operator@example.com
JIRA_API_TOKEN=your-atlassian-api-token
```
