---
'@mastra/core': patch
---

Fixed processor `sendSignal` calls being lost on durable and evented agents. A processor that kept the `sendSignal` from one step and called it later (for example, from a tool that was still running) wrote into a message list that had already been saved, so the model never saw the signal even though the call succeeded. These signals now go to the run's pending-signal queue and are included in the next model request, as they are on the default engine.
