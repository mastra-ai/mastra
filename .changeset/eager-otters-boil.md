---
'@mastra/factory': patch
---

Factory storage can now hold one issue or pull request on several boards at once, each board with its own card. The record itself is stored once and linked to every card, and each link holds the record's facts for that card; facts synced from GitHub, GitLab, Linear, Jira, incident.io and Vanta (state, labels, author, title) reach every card in one write, and each card runs its own board's rules when the record changes. Deleting one card keeps the record and its other cards. Existing cards are linked by a one-time background pass and keep working while it runs.

Databases that ran the first, reverted rollout of this feature are brought current by the same pass: links get the facts synced since, and links to cards deleted in the meantime are dropped, so deleting an issue's last card and filing it again works.
