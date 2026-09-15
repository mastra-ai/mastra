import { describe, expectTypeOf, it } from 'vitest';
import type { MastraDBMessage } from '@mastra/core/agent';
import type { MastraMemory } from '@mastra/core/memory';
import { persistGeneratedMessages, type GeneratedMessagePersistenceInput } from '@mastra/core/memory/internal';

describe('@mastra/core/memory/internal generated-message persistence types', () => {
  it('exports the framework persistence contract from the emitted subpath', () => {
    expectTypeOf<GeneratedMessagePersistenceInput>().toEqualTypeOf<{
      messages: MastraDBMessage[];
      memoryConfig?: Parameters<MastraMemory['saveMessages']>[0]['memoryConfig'];
      observabilityContext?: Parameters<MastraMemory['saveMessages']>[0]['observabilityContext'];
    }>();
    expectTypeOf(persistGeneratedMessages).parameter(0).toEqualTypeOf<MastraMemory>();
    expectTypeOf(persistGeneratedMessages).parameter(2).toEqualTypeOf<readonly string[]>();
    expectTypeOf(persistGeneratedMessages).returns.resolves.toEqualTypeOf<{
      messages: MastraDBMessage[];
      usage?: { tokens: number };
    }>();
  });
});
