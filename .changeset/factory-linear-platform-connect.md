---
'@mastra/factory': minor
'mastra': patch
---

Platform-mode Factory now connects Linear through Mastra Platform Connect, the same popup flow used for Jira, GitLab and incident.io. Existing Linear links keep working; workspaces connected with the old Linear app install show **Connect Linear** and need to connect again through Platform Connect.

Agent sessions can create Linear issues with the new `linear_create_issue` tool, which picks a team by key, name or ID. When the same team key exists in more than one connected workspace, the tool asks for the team ID instead of guessing. Self-hosted Factory also gains `linear_create_issue`, but only after the org reconnects Linear so the token includes the `issues:create` scope.

A Linear connection whose workspace can't be loaded (for example, a token revoked in Linear) is now skipped instead of breaking Linear for every connected workspace.

In platform mode, Linear label rules no longer run in a background poller: issues are ingested and auto-dispatched when the intake list is opened. The `MASTRACODE_PLATFORM_LINEAR_POLLING_ENABLED` environment variable is removed.
