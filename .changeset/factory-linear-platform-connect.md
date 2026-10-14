---
'@mastra/factory': minor
---

Platform-mode Factory now connects Linear through Mastra Platform Connect, the same popup flow used for Jira, GitLab and incident.io. Agent sessions can create Linear issues with the new `linear_create_issue` tool, which picks a team by key, name or ID. Existing Linear links keep working. Workspaces connected with the old Linear app install show **Reconnect Linear** until they reconnect.
