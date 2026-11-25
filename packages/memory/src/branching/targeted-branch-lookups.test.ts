import { MASTRA_THREAD_BRANCH_PARENT_METADATA_KEY, MASTRA_THREAD_BRANCH_STATE_METADATA_KEY } from '@mastra/core/memory';
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

// Branch bookkeeping finds a thread's branches through the indexed parent/state metadata keys, so
// it never loads a resource's (or every resource's) thread list to look for them.
describe('branch bookkeeping uses targeted thread lookups', () => {
  let memory: Memory;
  let store: MemoryStorage;
  let untargetedListCalls: StorageListThreadsInput[];

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

    untargetedListCalls = [];
    const listThreads = store.listThreads.bind(store);
    vi.spyOn(store, 'listThreads').mockImplementation(async input => {
      const metadata = input.filter?.metadata ?? {};
      const targeted =
        input.filter?.resourceId !== undefined &&
        input.perPage !== false &&
        (MASTRA_THREAD_BRANCH_PARENT_METADATA_KEY in metadata || MASTRA_THREAD_BRANCH_STATE_METADATA_KEY in metadata);
      if (!targeted) untargetedListCalls.push(input);
      return listThreads(input);
    });
  });

  it('recalls an ordinary thread without listing threads', async () => {
    await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    untargetedListCalls.length = 0;

    await memory.recall({ threadId: 'plain', resourceId });
    await memory.recall({ threadId: 'plain' });

    expect(untargetedListCalls).toEqual([]);
  });

  it('recalls a branch and lists its children without listing threads', async () => {
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    untargetedListCalls.length = 0;

    const recalled = await memory.recall({ threadId: branch.thread.id });
    const children = await memory.listBranches({ threadId: 'root' });

    expect(recalled.messages.map(m => m.id)).toEqual(['fork']);
    expect(children.branches.map(child => child.thread.id)).toEqual([branch.thread.id]);
    expect(untargetedListCalls).toEqual([]);
  });

  it('saves, updates, moves and deletes threads without listing threads', async () => {
    await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    untargetedListCalls.length = 0;

    await memory.saveMessages({ messages: [message('later', 'plain', new Date(forkTime.getTime() + 1))] });
    await memory.updateThread({ id: 'plain', title: 'renamed' });
    await memory.updateThreadResourceId({ threadId: 'plain', resourceId: 'moved-resource' });
    await memory.deleteThread('plain');

    expect(untargetedListCalls).toEqual([]);
  });

  it('still refuses to delete a thread that has branches', async () => {
    await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });

    await expect(memory.deleteThread('root')).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    expect(untargetedListCalls).toEqual([]);
  });

  it('still refuses to move a thread with branches to another resource', async () => {
    await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });

    await expect(
      memory.updateThreadResourceId({ threadId: 'root', resourceId: otherResourceId }),
    ).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    expect(untargetedListCalls).toEqual([]);
  });

  it('still refuses to delete or rewrite a message a branch shares', async () => {
    await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    untargetedListCalls.length = 0;

    await expect(memory.deleteMessages(['fork'])).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    await expect(
      memory.saveMessages({
        messages: [
          { ...message('fork', 'root', forkTime), content: { format: 2, parts: [{ type: 'text', text: 'x' }] } },
        ],
      }),
    ).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    expect(untargetedListCalls).toEqual([]);
  });

  it('stores the indexed keys on branches and strips them from returned threads', async () => {
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });

    const raw = await store.getThreadById({ threadId: branch.thread.id });
    expect(raw?.metadata).toMatchObject({
      [MASTRA_THREAD_BRANCH_PARENT_METADATA_KEY]: 'root',
      [MASTRA_THREAD_BRANCH_STATE_METADATA_KEY]: 'ready',
    });
    const returned = await memory.getThreadById({ threadId: branch.thread.id });
    expect(Object.keys(returned?.metadata ?? {})).not.toContain(MASTRA_THREAD_BRANCH_PARENT_METADATA_KEY);
    expect(Object.keys(branch.thread.metadata ?? {})).not.toContain(MASTRA_THREAD_BRANCH_STATE_METADATA_KEY);
    await expect(
      memory.listThreads({ filter: { metadata: { [MASTRA_THREAD_BRANCH_PARENT_METADATA_KEY]: 'root' } } }),
    ).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
  });

  it('authorizes and inspects branch lineage without listing threads', async () => {
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    untargetedListCalls.length = 0;

    const ancestors = await getThreadBranchAuthorizationCandidates(memory, branch.thread.id, 'ancestors');
    const descendants = await getThreadBranchAuthorizationCandidates(memory, 'root', 'descendants');
    const state = await inspectThreadBranchState(memory, 'root');

    expect(ancestors.map(candidate => candidate.id).sort()).toEqual([branch.thread.id, 'root'].sort());
    expect(descendants.map(candidate => candidate.id).sort()).toEqual([branch.thread.id, 'root'].sort());
    expect(state).toEqual({ state: 'ordinary', hasReadyDescendants: true });
    expect(untargetedListCalls).toEqual([]);
  });
});
