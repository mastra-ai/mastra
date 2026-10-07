---
'@mastra/libsql': patch
'@mastra/pg': patch
---

Knowledge now initializes on databases where an earlier release created its tables but never stored anything in them. Those empty tables are replaced automatically. If they hold rows, carry extra indexes, or have views or triggers depending on them, initialization stops without changing anything, and the error names `dangerouslyReset()` as the way to replace Knowledge storage.
