---
'@mastra/factory': patch
---

Jira boards in Factory open faster and no longer create cards while a list loads. Factory now checks Jira every five minutes and files new issues of each routed project itself. This happens with no board open. Setting `MASTRACODE_JIRA_RECONCILE_ENABLED=false` also stops these new cards.
