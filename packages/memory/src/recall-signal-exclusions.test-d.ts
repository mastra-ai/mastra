import type { AgentSignalType } from '@mastra/core/agent';
import type { MastraMemory, MockMemory } from '@mastra/core/memory';
import { expectTypeOf, test } from 'vitest';

import type { Memory } from './index';

test('recall exclusion literals stay compatible with core without importing them in published memory types', () => {
  type RecallOptions = Parameters<Memory['recall']>[0];
  type RecallSignalType = NonNullable<RecallOptions['excludeSignals']>[number];
  expectTypeOf<RecallSignalType>().toEqualTypeOf<AgentSignalType>();
  expectTypeOf<RecallSignalType>().toEqualTypeOf<
    NonNullable<Parameters<MastraMemory['recall']>[0]['excludeSignals']>[number]
  >();
  expectTypeOf<RecallSignalType>().toEqualTypeOf<
    NonNullable<Parameters<MockMemory['recall']>[0]['excludeSignals']>[number]
  >();
  const options: RecallOptions = {
    threadId: 'thread',
    excludeSignals: ['reactive', 'system-reminder', 'user', 'user-message', 'state', 'notification'],
  };
  expectTypeOf(options).toExtend<RecallOptions>();
  // @ts-expect-error No new signal categories are introduced by recall.
  const invalid: RecallOptions = { threadId: 'thread', excludeSignals: ['dynamic-agents-md'] };
  void invalid;
});
