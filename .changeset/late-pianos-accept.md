---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/mongodb': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Added expectedTrajectory support to dataset items across all storage backends and API layer. Dataset items can now store trajectory expectations that define expected agent execution steps, ordering, and constraints for trajectory-based evaluation scoring.
