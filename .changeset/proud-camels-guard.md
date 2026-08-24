---
'@mastra/memory': patch
---

Fixed observational memory being silently wiped when every reflection attempt produced empty or degenerate output. Failed reflections now throw and leave existing observations intact.

Threshold-triggered synchronous reflections now back off for 5 minutes after an attempt that failed or finished still over the reflection threshold. Reflection retries early if observations grow another 15%.
