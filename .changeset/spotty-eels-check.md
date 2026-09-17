---
'@mastra/core': patch
---

Fixed a memory and connection leak in `DurableAgent`. After a run finished, the automatic cleanup timer released the run's registry state but left the stream subscription attached for the life of the process, so memory (and on Redis/Valkey streams, a client connection per run) grew with every turn. `stream()`, `resume()`, and `recover()` now release the subscription during automatic cleanup, the same way `observe()` already did. Fixes #24070.
