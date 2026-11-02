---
'@mastra/factory': patch
---

Board column pages, per-column counts, session and thread lookups, and board sync no longer read every card in the project. Factory now keeps a small index of each card's columns and session, thread and branch references, so a board launch reads only the cards it shows.

The index is built in the background the first time a project's board is read. Until it is ready, and for filters it can't answer (search, labels, people), reads fall back to loading every card as before. No configuration or migration is needed; the new tables are created on startup.
