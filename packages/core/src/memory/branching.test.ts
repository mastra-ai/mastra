import { describe, expect, it } from 'vitest';
import type {
  BranchThreadInput,
  BranchThreadOutput,
  GetThreadBranchInput,
  ListThreadBranchesInput,
  ListThreadBranchesOutput,
  ThreadBranchHistoryOutput,
} from './branching';
import { MASTRA_THREAD_BRANCH_METADATA_KEY } from './branching';
import { MockMemory } from './mock';

describe('MastraMemory thread branching contract', () => {
  it('keeps branching unsupported by default without affecting legacy methods', async () => {
    const memory = new MockMemory();

    expect(memory.supportsThreadBranching).toBe(false);
    await expect(memory.branchThread({ threadId: 'root', branchPointMessageId: 'message' })).rejects.toMatchObject({
      id: 'BRANCHING_UNSUPPORTED',
    });
    await expect(memory.getParentThread({ threadId: 'root' })).rejects.toMatchObject({
      id: 'BRANCHING_UNSUPPORTED',
    });
    await expect(memory.listBranches({ threadId: 'root' })).rejects.toMatchObject({
      id: 'BRANCHING_UNSUPPORTED',
    });
    await expect(memory.getBranchHistory({ threadId: 'root' })).rejects.toMatchObject({
      id: 'BRANCHING_UNSUPPORTED',
    });

    const thread = await memory.createThread({ resourceId: 'resource', threadId: 'legacy-thread' });
    expect(thread.id).toBe('legacy-thread');
  });

  it('exports the exact public branch type shapes', () => {
    const input = {
      threadId: 'root',
      branchPointMessageId: 'message',
      title: 'Branch',
      metadata: { purpose: 'test' },
    } satisfies BranchThreadInput;
    const getInput = { threadId: input.threadId } satisfies GetThreadBranchInput;
    const listInput = { ...getInput, page: 0, perPage: false } satisfies ListThreadBranchesInput;
    const output = null as BranchThreadOutput | null;
    const listOutput = null as ListThreadBranchesOutput | null;
    const historyOutput = null as ThreadBranchHistoryOutput | null;

    expect(input.branchPointMessageId).toBe('message');
    expect(listInput.perPage).toBe(false);
    expect(output).toBeNull();
    expect(listOutput).toBeNull();
    expect(historyOutput).toBeNull();
  });

  it.each([MASTRA_THREAD_BRANCH_METADATA_KEY, 'memoryTokenLimiter'])(
    'rejects caller-authored reserved metadata key %s before createThread writes',
    async reservedKey => {
      const memory = new MockMemory();

      await expect(
        memory.createThread({
          resourceId: 'resource',
          metadata: { [reservedKey]: {} },
        }),
      ).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });

      expect((await memory.listThreads({ perPage: false })).threads).toHaveLength(0);
    },
  );
});
