---
'@mastra/docker': patch
---

Fixed Docker process termination metadata being lost when the exec stream ended before the kill helper confirmed termination.
