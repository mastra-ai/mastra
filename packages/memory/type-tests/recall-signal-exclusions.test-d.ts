import type { AgentSignalType } from '@mastra/core/agent';
import type { MastraMemory, MockMemory } from '@mastra/core/memory';
import { expectTypeOf, test } from 'vitest';

import type { Memory } from '../src/index';

test('recall exclusion literals stay compatible with core without importing them in published memory types', () => {
  type RecallOptions = Parameters<Memory['recall']>[0];
  type RecallSignalType = Exclude<RecallOptions['hideSignals'], boolean | undefined>[number];
  expectTypeOf<RecallSignalType>().toEqualTypeOf<AgentSignalType>();
  expectTypeOf<RecallOptions['hideSignals']>().toEqualTypeOf<boolean | AgentSignalType[] | undefined>();
  expectTypeOf<RecallOptions['hideSignals']>().toEqualTypeOf<Parameters<MastraMemory['recall']>[0]['hideSignals']>();
  expectTypeOf<RecallOptions['hideSignals']>().toEqualTypeOf<Parameters<MockMemory['recall']>[0]['hideSignals']>();
  const options: RecallOptions = {
    threadId: 'thread',
    hideSignals: ['reactive', 'system-reminder', 'user', 'user-message', 'state', 'notification'],
  };
  expectTypeOf(options).toExtend<RecallOptions>();
  // @ts-expect-error No new signal categories are introduced by recall.
  const invalid: RecallOptions = { threadId: 'thread', hideSignals: ['dynamic-agents-md'] };
  void invalid;
  // @ts-expect-error the unshipped spelling is not a compatibility alias
  const oldOption: RecallOptions = { threadId: 'thread', excludeSignals: ['reactive'] };
  // @ts-expect-error core's abstract recall contract uses the same public spelling
  const oldCoreOption: Parameters<MastraMemory['recall']>[0] = { threadId: 'thread', excludeSignals: [] };
  // @ts-expect-error mock recall uses the same public spelling
  const oldMockOption: Parameters<MockMemory['recall']>[0] = { threadId: 'thread', excludeSignals: [] };
  void oldOption;
  void oldCoreOption;
  void oldMockOption;
});
