---
'@mastra/playground-ui': patch
---

Fixed feedback comment filters on the Traces page being silently ignored. Comment filters such as "matches" or "is" now reach the trace query instead of showing a chip that filtered nothing.
