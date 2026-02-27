---
'@mastra/memory': minor
'@mastra/core': patch
'@mastra/mongodb': patch
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/upstash': patch
'mastracode': patch
---

**Memory**: Added Observational Memory cloning when forking threads. Thread-scoped OM is cloned with remapped message IDs. Resource-scoped OM is shared when the resourceId stays the same, and cloned with remapped thread tags when the resourceId changes. Multi-generation OM history (including reflections) is preserved during cloning.

**Core**: `Harness.cloneThread()` now resolves dynamic memory factories before cloning, fixing "cloneThread is not a function" errors when memory is provided as a factory function. `HarnessConfig.memory` type widened to `DynamicArgument<MastraMemory>`.

**Storage adapters**: Added `insertObservationalMemoryRecord()` to PostgreSQL, LibSQL, and MongoDB adapters for OM cloning support.

**MastraCode**: Added `/clone` command with confirm/cancel and optional rename prompts. Thread selector now sorts threads tagged with the current directory above other same-resource threads. Auto-resume shows thread selector when multiple directory threads exist instead of silently picking the most recent. Thread lock prompts now include a "Switch thread" option to open the thread selector.
