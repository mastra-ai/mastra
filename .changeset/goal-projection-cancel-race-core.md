---
'@mastra/core': patch
---

Fixed an active goal being reported as cancelled when its objective was written while a run was already in flight. The objective a goal state projection sees is now read from storage whenever the run-start read found nothing, so a goal started or restarted mid-run is no longer projected as having no objective.
