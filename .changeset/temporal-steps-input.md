---
'@mastra/temporal': patch
---

Fixed Temporal workflow results to include the workflow input under `result.steps.input` again, matching a local run. `run.start()` includes it for successful, failed, tripwire and suspended results, and `run.resume()` includes it for suspended and successful results.
