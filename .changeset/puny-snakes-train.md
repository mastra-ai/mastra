---
'@mastra/factory': patch
---

Stopped Factory's background issue sweeps from reading the database when nothing changed. The Jira, incident.io, GitLab and Linear issue sweeps and GitHub pull request discovery now keep each project's synced cards in memory and read a board again only after it changes, on any replica. Apart from Linear intake discovery, an idle Factory makes no database queries during these sweeps, which helps databases that suspend when unused.
