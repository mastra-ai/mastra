---
'@mastra/server': patch
'@mastra/client-js': patch
---

Added an optional `notScorable` field on experiment item score results so clients can tell a skipped run apart from a scorer error.
