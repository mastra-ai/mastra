---
'@mastra/core': minor
---

Added `getWorkingMemoryInstruction()` to `MastraMemory`, so a memory implementation can set the working memory instruction an agent receives. The `WorkingMemory` input processor now asks the memory instance for the instruction. Return `undefined` to keep the built-in instruction, or an empty string to send none. See [#29752](https://github.com/mastra-ai/mastra/issues/29752).

```ts
import type { WorkingMemoryInstructionArgs } from '@mastra/core/processors';
import { Memory } from '@mastra/memory';

class DurableFactsMemory extends Memory {
  override getWorkingMemoryInstruction(args: WorkingMemoryInstructionArgs) {
    if (args.kind === 'read-only') return super.getWorkingMemoryInstruction(args);
    return `Save only lasting facts about the user with updateWorkingMemory.\n${args.data ?? ''}`;
  }
}
```
