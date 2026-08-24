---
'@mastra/memory': patch
---

Fixed observational memory being silently wiped when every reflection attempt produced empty or degenerate output. Failed reflections now throw and leave existing observations intact.

Threshold-triggered synchronous reflections are no longer re-run against unchanged observations after an attempt that failed or finished still over the reflection threshold. Reflection retries as soon as observations change.
