---
'@internal/playground': patch
---

Change the default agent chat Max Steps in Studio from 5 to 15. This is the fallback default used when there's no saved override and the agent specifies no code default; saved user values and agent code defaults still take precedence.
