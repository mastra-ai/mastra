---
'@mastra/factory': patch
'@mastra/code-sdk': patch
'@mastra/core': patch
---

Added an option to the instruction-file reminder processor that lets hosts disable injection entirely for a request, so instruction files from untrusted checkouts are never surfaced as reminders.
