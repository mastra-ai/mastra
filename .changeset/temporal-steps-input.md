---
'@mastra/temporal': patch
---

Fixed `run.start()` and `run.resume()` on Temporal workflows to return the workflow input under `result.steps.input` again, matching a local run. Successful, failed, tripwire and suspended results all include it.
