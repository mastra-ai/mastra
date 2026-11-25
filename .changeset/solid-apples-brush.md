---
'@mastra/factory': minor
---

Added `runEnded(binding)` to `FactoryBoardEngine`. Factory now asks the board engine what a finished run means for its card instead of applying the run's outcome itself, so a custom engine decides when a phase ends. The engine factory also receives `workItems` and `boards`. A custom engine that wraps `createDispatcherBoardEngine(context)` keeps today's behaviour by forwarding `runEnded`.
