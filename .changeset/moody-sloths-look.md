---
'@mastra/core': patch
---

Added transient option for data chunks to skip database persistence. Workspace tools now mark stdout/stderr streaming chunks as transient, reducing storage bloat from large command outputs while still streaming them to the client for live display.
