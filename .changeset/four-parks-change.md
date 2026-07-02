---
'@mastra/core': patch
---

`createCodingAgent` now only includes the default `TaskSignalProvider` when `memory` is configured. Previously it always wired `TaskSignalProvider`, whose `TaskStateProcessor` requires a memory-backed thread — causing a hard error in memoryless contexts. The provider is merged into caller-provided signals when memory is present, so custom signal providers don't drop task tracking.
