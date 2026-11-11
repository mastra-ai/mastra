---
'@mastra/factory': patch
---

Open Factory boards no longer slow down the whole server. Listing a repository's issues or pull requests used to run every listed entry through the GitHub rules before answering, and every open board repeats those lists every 30 seconds. The lists now just return what GitHub sends. Cards still come from webhooks, the GitHub event poller, the reconcilers, and the import when a repository is linked.

GitHub, GitLab, Linear, Jira, and incident.io rules also stop copying the whole card list for every event they handle, so a busy board no longer blocks other requests while events arrive.
