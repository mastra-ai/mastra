---
'@mastra/factory': minor
'create-factory': patch
---

Added a Jira Cloud intake integration for the Software Factory. Set JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN to select Jira projects as intake sources in Settings, browse their active issues on the board, and give agents jira_get_issue and jira_create_comment tools. Credentials are deployment-global (an Atlassian API token) — no OAuth app setup needed.
