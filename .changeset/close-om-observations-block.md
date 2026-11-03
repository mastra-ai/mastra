---
'@mastra/memory': patch
---

Fixed Observational Memory context leaving the `<observations>` block open. The block now ends with `</observations>` right after the last observation, so current-task and suggested-response hints are no longer read as part of the observations. Fixes #29141.
