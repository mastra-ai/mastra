---
'@mastra/inngest': patch
---

Fixed `InngestAgent.resume()` crashing with `Cannot read properties of undefined (reading 'threadId')` when called right after a tool suspends. `resume()` now waits for the suspended run to be saved before resuming it, and rejects with a clear error if the run is not suspended. Fixes #24749.
