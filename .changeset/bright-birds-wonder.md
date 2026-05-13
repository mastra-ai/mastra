---
'@mastra/core': patch
'mastracode': patch
---

Fixed a bug where clicking Approve on a plan from `/plan` mode would show the system reminder twice and sometimes hang instead of starting build execution. Approving now reliably triggers the build agent with a single reminder.
