---
'@mastra/factory': patch
---

Fixed Platform-managed GitLab connections created with a personal access token not being discovered. Factory now lists connections from every GitLab credential flow the Platform offers, and the documentation no longer presents `MASTRA_GITLAB_CONNECTION_ID` as required; it only pins discovery to one connection.
