import { describe, expectTypeOf, it } from 'vitest';
import type { MastraDBMessage } from '@mastra/core/agent';
import type { MastraMemory, StorageThreadType } from '@mastra/core/memory';
import {
  persistGeneratedMessages,
  persistMessagesWithThreadCreation,
  type GeneratedMessagePersistenceInput,
} from '@mastra/core/memory/internal';

describe('@mastra/core/memory/internal generated-message persistence types', () => {
  it('exports the framework persistence contract from the emitted subpath', () => {
    expectTypeOf<GeneratedMessagePersistenceInput>().toEqualTypeOf<{
      messages: MastraDBMessage[];
      memoryConfig?: Parameters<MastraMemory['saveMessages']>[0]['memoryConfig'];
      observabilityContext?: Parameters<MastraMemory['saveMessages']>[0]['observabilityContext'];
      thread?: StorageThreadType;
    }>();
    expectTypeOf(persistGeneratedMessages).parameter(0).toEqualTypeOf<MastraMemory>();
    expectTypeOf(persistGeneratedMessages).parameter(2).toEqualTypeOf<readonly string[]>();
    expectTypeOf(persistMessagesWithThreadCreation).parameter(1).toEqualTypeOf<GeneratedMessagePersistenceInput>();
    expectTypeOf(persistMessagesWithThreadCreation).returns.resolves.toEqualTypeOf<{
      messages: MastraDBMessage[];
      usage?: { tokens: number };
    }>();
    expectTypeOf(persistGeneratedMessages).returns.resolves.toEqualTypeOf<{
      messages: MastraDBMessage[];
      usage?: { tokens: number };
    }>();
  });
});
