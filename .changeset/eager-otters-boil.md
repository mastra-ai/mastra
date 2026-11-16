---
'@mastra/factory': patch
---

Factory storage can now hold one issue or pull request on several boards at once, each board with its own card. The record itself is stored once and linked to every card, and each link holds the record's facts for that card; facts synced from GitHub, GitLab, Linear, Jira, incident.io and Vanta (state, labels, author, title) reach every card in one write, and each card runs its own board's rules when the record changes. Deleting one card keeps the record and its other cards. Existing cards keep working as they are and are linked the next time their record syncs.
