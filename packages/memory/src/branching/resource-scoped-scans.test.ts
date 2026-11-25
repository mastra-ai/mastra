import type { MastraDBMessage } from '@mastra/core/memory';
import { getThreadBranchAuthorizationCandidates, inspectThreadBranchState } from '@mastra/core/memory/internal';
import { InMemoryStore } from '@mastra/core/storage';
import type { MemoryStorage, StorageListThreadsInput } from '@mastra/core/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Memory } from '../index';

const resourceId = 'scan-resource';
const otherResourceId = 'other-resource';
const forkTime = new Date('2026-01-01T00:00:00.000Z');

function message(id: string, threadId: string, createdAt: Date, owner = resourceId): MastraDBMessage {
  return {
    id,
    threadId,
    resourceId: owner,
    role: 'user',
    type: 'text',
    content: { format: 2, parts: [{ type: 'text', text: id }] },
    createdAt,
  };
}

// Branch lineage never crosses resources, so branch bookkeeping must only ever list the
// threads of the resource that owns the requested thread — never every resource's threads.
describe('branch bookkeeping only lists the owning resource’s threads', () => {
  let memory: Memory;
  let store: MemoryStorage;
  let unscopedListCalls: StorageListThreadsInput[];

  beforeEach(async () => {
    memory = new Memory({ storage: new InMemoryStore() });
    store = (await memory.storage.getStore('memory'))!;
    await memory.createThread({ threadId: 'root', resourceId });
    await memory.saveMessages({ messages: [message('fork', 'root', forkTime)] });
    await memory.createThread({ threadId: 'plain', resourceId });
    await memory.createThread({ threadId: 'foreign', resourceId: otherResourceId });
    await memory.saveMessages({
      messages: [message('foreign-msg', 'foreign', forkTime, otherResourceId)],
    });

    unscopedListCalls = [];
    const listThreads = store.listThreads.bind(store);
    vi.spyOn(store, 'listThreads').mockImplementation(async input => {
      if (input.filter?.resourceId === undefined) unscopedListCalls.push(input);
      return listThreads(input);
    });
  });

  it('recalls an ordinary thread without listing other resources', async () => {
    await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    unscopedListCalls.length = 0;

    await memory.recall({ threadId: 'plain', resourceId });
    await memory.recall({ threadId: 'plain' });

    expect(unscopedListCalls).toEqual([]);
  });

  it('recalls a branch and lists its children without listing other resources', async () => {
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    unscopedListCalls.length = 0;

    const recalled = await memory.recall({ threadId: branch.thread.id });
    const children = await memory.listBranches({ threadId: 'root' });

    expect(recalled.messages.map(m => m.id)).toEqual(['fork']);
    expect(children.branches.map(child => child.thread.id)).toEqual([branch.thread.id]);
    expect(unscopedListCalls).toEqual([]);
  });

  it('saves, updates, moves and deletes threads without listing other resources', async () => {
    await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    unscopedListCalls.length = 0;

    await memory.saveMessages({ messages: [message('later', 'plain', new Date(forkTime.getTime() + 1))] });
    await memory.updateThread({ id: 'plain', title: 'renamed' });
    await memory.updateThreadResourceId({ threadId: 'plain', resourceId: 'moved-resource' });
    await memory.deleteThread('plain');

    expect(unscopedListCalls).toEqual([]);
  });

  it('still refuses to delete a thread that has branches', async () => {
    await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });

    await expect(memory.deleteThread('root')).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    expect(unscopedListCalls).toEqual([]);
  });

  it('still refuses to move a thread with branches to another resource', async () => {
    await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });

    await expect(
      memory.updateThreadResourceId({ threadId: 'root', resourceId: otherResourceId }),
    ).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    expect(unscopedListCalls).toEqual([]);
  });

  it('authorizes and inspects branch lineage without listing other resources', async () => {
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    unscopedListCalls.length = 0;

    const ancestors = await getThreadBranchAuthorizationCandidates(memory, branch.thread.id, 'ancestors');
    const descendants = await getThreadBranchAuthorizationCandidates(memory, 'root', 'descendants');
    const state = await inspectThreadBranchState(memory, 'root');

    expect(ancestors.map(candidate => candidate.id).sort()).toEqual([branch.thread.id, 'root'].sort());
    expect(descendants.map(candidate => candidate.id).sort()).toEqual([branch.thread.id, 'root'].sort());
    expect(state).toEqual({ state: 'ordinary', hasReadyDescendants: true });
    expect(unscopedListCalls).toEqual([]);
  });
});
