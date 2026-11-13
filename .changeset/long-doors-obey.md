---
'@mastra/factory': patch
---

GitLab boards in Factory no longer create cards while a list loads. Factory now checks GitLab every five minutes and files new merge requests and issues itself. This works without a webhook and with no board open. Setting `MASTRACODE_GITLAB_RECONCILE_ENABLED=false` also stops these new cards.
