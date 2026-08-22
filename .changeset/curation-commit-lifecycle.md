---
"@mastra/memory": patch
---

Count every successful knowledge commit toward `curationCadence`, including buffered and idle-buffered commits, so a thread that never gets another user turn can still reach the curator. Cadence stays off by default, and the counter is advisory: concurrent commits can land on it at once, so curation may run a little early or late.
