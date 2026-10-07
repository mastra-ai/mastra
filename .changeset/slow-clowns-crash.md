---
'@mastra/playground-ui': patch
---

Fixed feedback comment filters in the Studio Traces list doing nothing. Filtering by a comment ("is", "is not", "matches", and the other comment operators) now narrows the list instead of being silently dropped.
