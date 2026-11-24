---
'@mastra/connect': patch
---

Fixed Jira and Confluence tools using an Atlassian site they looked up earlier after you chose a different site in the connection's metadata. A `cloudId` set on the connection now takes precedence over a site a tool discovered on its own, so the next call goes to the site you chose.
