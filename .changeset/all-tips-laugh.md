---
'@mastra/factory': patch
---

Stopped the Mastra platform GitHub event poll from reading the Factory database every 20 seconds. It now remembers which repositories are linked to projects and reads them again only when a link or connection changes. Renamed repositories are picked up from the platform during the hourly reconcile. An idle Factory makes fewer database queries, which helps databases that suspend when unused.
