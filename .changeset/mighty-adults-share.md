---
'@mastra/server': patch
'@mastra/client-js': patch
---

Added an optional `notScorable` field to experiment item score results. When a scorer declares a run not scorable via `notScorable()`, the item response carries `{ step, reason }` alongside `score: null` so clients can tell "nothing to score" apart from a scorer error.
