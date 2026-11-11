---
'@mastra/code-sdk': patch
'@mastra/core': patch
---

Avoid blocking the event loop while loading instruction files from a trusted Git ref and while discovering tool-result instruction reminders. Keep missing and untrusted-ref behavior unchanged.
