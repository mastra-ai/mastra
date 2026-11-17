---
'@mastra/factory': patch
---

Jira boards in Factory open faster and no longer create cards while a list loads. Factory now checks Jira every five minutes and files new issues of each routed project itself. This happens with no board open. The `MASTRACODE_JIRA_RECONCILE_ENABLED`, `MASTRACODE_LINEAR_ISSUE_RECONCILE_ENABLED` and `MASTRACODE_LINEAR_RECONCILE_ENABLED` settings are removed: the Jira and Linear checks always run. To stop a provider for one organization, turn it off in Settings › Work Intake.
