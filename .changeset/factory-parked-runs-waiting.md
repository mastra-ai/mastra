---
'@mastra/factory': patch
---

A Factory run parked on a tool prompt (a plan to review, a question to answer) now reads as waiting instead of running: session state reports it as `parked`, the board card shows it as waiting, and `factory_list_attention` lists it under `waiting` right away instead of it only surfacing when the run is flagged overdue hours later.
