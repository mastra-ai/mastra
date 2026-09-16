// eslint-disable-next-line import/order -- Emitted self-import ordering differs before and after the package build.
import { describe, expectTypeOf, it } from 'vitest';
import type { MastraDBMessage } from '@mastra/core/agent';
import type { MastraMemory, StorageThreadType } from '@mastra/core/memory';
import {
  branchThreadWithGeneratedId,
  persistGeneratedMessages,
  persistMessagesWithThreadCreation,
  type GeneratedMessagePersistenceInput,
} from '@mastra/core/memory/internal';
import type { BranchThreadInput, BranchThreadOutput } from '@mastra/core/storage';

describe('@mastra/core/memory/internal generated-message persistence types', () => {
  it('exports the framework persistence contract from the emitted subpath', () => {
    expectTypeOf<GeneratedMessagePersistenceInput>().toEqualTypeOf<{
      messages: MastraDBMessage[];
      memoryConfig?: Parameters<MastraMemory['saveMessages']>[0]['memoryConfig'];
      observabilityContext?: Parameters<MastraMemory['saveMessages']>[0]['observabilityContext'];
      thread?: StorageThreadType;
      requireThreadCreation?: boolean;
    }>();
    expectTypeOf(persistGeneratedMessages).parameter(0).toEqualTypeOf<MastraMemory>();
    expectTypeOf(persistGeneratedMessages).parameter(2).toEqualTypeOf<readonly string[]>();
    expectTypeOf(branchThreadWithGeneratedId)
      .parameter(1)
      .toEqualTypeOf<BranchThreadInput & { generatedThreadId: string }>();
    expectTypeOf(branchThreadWithGeneratedId).returns.resolves.toEqualTypeOf<BranchThreadOutput>();
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
