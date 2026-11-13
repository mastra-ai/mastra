---
'@mastra/memory': patch
---

Fixed agents ignoring working memory instruction overrides on `Memory` subclasses. Overriding `getWorkingMemoryToolInstruction`, `getReadOnlyWorkingMemoryInstruction`, or `__experimental_getWorkingMemoryToolInstructionVNext` now changes the instruction the agent sends to the model, the same as `memory.getSystemMessage()`. `memory.getSystemMessage()` also now uses the vnext instruction when `version: 'vnext'` is set on the `Memory` instance, matching what agents receive. Fixes [#29752](https://github.com/mastra-ai/mastra/issues/29752).

`memory.getSystemMessage()` returns `null` when an override renders an empty instruction.

`@mastra/memory` now requires `@mastra/core` 1.84.0 or later.
