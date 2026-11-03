---
'mastra': patch
---

Fixed Studio's Knowledge page getting stuck on "Loading knowledge…" when Studio was open in other tabs. Each tab kept the Knowledge change stream open, and browsers allow only about six connections per host, so a new tab's requests could wait forever. A tab in the background now closes its stream, and reconnects and refreshes when you come back to it.
