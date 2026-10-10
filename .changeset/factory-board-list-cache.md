---
'@mastra/factory': patch
---

Factory boards no longer reload every card from the database on each poll. Each project now has a board version that changes on every card write (including comment counts), and the card list is served from memory while the version is unchanged, refreshing at least once a minute. Open board tabs on large projects no longer drive heavy database load, and edits still appear on the next poll from any server replica.
