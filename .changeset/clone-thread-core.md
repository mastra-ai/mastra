---
'@mastra/core': patch
---

`Harness.cloneThread()` now resolves dynamic memory factories before cloning, fixing "cloneThread is not a function" errors when memory is provided as a factory function. `HarnessConfig.memory` type widened to `DynamicArgument<MastraMemory>`.
