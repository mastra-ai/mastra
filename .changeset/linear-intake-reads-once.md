---
'mastra': patch
---

Reduced provider requests from the Factory board. The board no longer asks Linear, Jira or incident.io for their issue lists, and reads the GitHub and GitLab lists when it opens or its tab regains focus instead of every 30 seconds. Linear, Jira and incident.io issues now reach the board only as cards the server files, so an open issue with no card no longer appears in Intake until it next changes at the provider.
