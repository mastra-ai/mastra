import type { MastraMemory } from '@mastra/core/memory';
import type { WorkingMemoryInstructionArgs } from '@mastra/core/processors';
import { expectTypeOf, test } from 'vitest';

import type { Memory } from '../src/index';

// Memory declares getWorkingMemoryInstruction with a local copy of core's WorkingMemoryInstructionArgs, so its
// published types don't name an export that older in-range cores lack (#29752). This fails if the copy drifts.
test('Memory.getWorkingMemoryInstruction takes the same args as the core WorkingMemory processor passes', () => {
  type MemoryArgs = Parameters<Memory['getWorkingMemoryInstruction']>[0];

  expectTypeOf<MemoryArgs>().toEqualTypeOf<WorkingMemoryInstructionArgs>();
  expectTypeOf<MemoryArgs>().toEqualTypeOf<Parameters<MastraMemory['getWorkingMemoryInstruction']>[0]>();
  expectTypeOf<ReturnType<Memory['getWorkingMemoryInstruction']>>().toEqualTypeOf<string | undefined>();
});
