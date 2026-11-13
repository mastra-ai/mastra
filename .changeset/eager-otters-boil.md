---
'@mastra/factory': patch
---

Factory storage can now hold one issue or pull request on several boards at once, each board with its own card. The record itself is stored once and linked to every card; facts synced from GitHub, GitLab, Linear, Jira, incident.io and Vanta (state, labels, author, title) reach every card in one write, and each card runs its own board's rules when the record changes. Deleting one card keeps the record and its other cards. Existing cards are linked by a one-time background backfill and keep working while it runs.
