---
'@mastra/memory': patch
---

Never commit an empty reflection over non-empty observations, and back off unproductive synchronous reflections. When every reflector attempt produced degenerate output, the compression ladder returned an empty string that was committed verbatim as the new active observations — silently wiping observational memory (the buffered path similarly dropped the reflected slice). The reflector now throws instead, surfacing a failed reflection while leaving observations intact. Separately, threshold-triggered synchronous reflection now backs off for 5 minutes after an attempt that failed or finished still over the reflection threshold (retrying early if observations grow 15%), instead of blocking every subsequent activation on a reflection that just demonstrated it cannot succeed.
