---
'@mastra/factory': minor
'create-factory': patch
---

Added Jira Cloud as an intake source for the Software Factory.

- Select Jira projects in **Settings → Intake**, route them to a Factory, and browse active issues on its board.
- Give agents full issue context through the read-only `jira_get_issue` tool.
- Reuse organization-scoped Jira connections from Mastra Platform; provider requests run through the integrations v2 proxy and credentials never enter the Factory deployment.
