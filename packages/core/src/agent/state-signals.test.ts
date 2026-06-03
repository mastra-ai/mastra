import { describe, expect, it } from 'vitest';

import type { MastraMemory } from '../memory/memory';
import { MessageList } from './message-list';
import { createSignal } from './signals';
import { resolveStateSignalHistory } from './state-signals';
import type { StateSignalTracking } from './state-signals';

function buildStateSignalDBMessage({
  id,
  threadId,
  resourceId,
  stateId,
  cacheKey,
  mode,
  createdAt,
}: {
  id: string;
  threadId: string;
  resourceId: string;
  stateId: string;
  cacheKey: string;
  mode: 'snapshot' | 'delta';
  createdAt: Date;
}) {
  const signal = createSignal({
    id,
    type: 'state',
    tagName: 'state',
    contents: '# working memory\n- name: Caleb',
    createdAt,
    metadata: {
      state: { id: stateId, threadId, cacheKey, mode },
    },
  });
  return signal.toDBMessage({ threadId, resourceId });
}

describe('resolveStateSignalHistory', () => {
  const threadId = 'thread-1';
  const resourceId = 'resource-1';
  const stateId = 'working-memory';
  const cacheKey = 'abc123';

  it('reports hasSnapshot=true when prior snapshot is in storage but outside the in-prompt context window', async () => {
    // Empty in-prompt window — simulates observational memory or aggressive context trimming
    // where prior signal rows are not in the current MessageList.
    const messageList = new MessageList({ threadId, resourceId });

    const storedSnapshot = buildStateSignalDBMessage({
      id: 'signal-snapshot-1',
      threadId,
      resourceId,
      stateId,
      cacheKey,
      mode: 'snapshot',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    });

    const memory = {
      storage: {
        getStore: async () => ({
          listMessages: async () => ({ messages: [storedSnapshot] }),
        }),
      },
    } as unknown as MastraMemory;

    const tracking: StateSignalTracking = {
      currentCacheKey: cacheKey,
      currentMode: 'snapshot',
      version: 1,
      lastSignalId: 'signal-snapshot-1',
      lastSnapshotSignalId: 'signal-snapshot-1',
    };

    const history = await resolveStateSignalHistory({
      messageList,
      memory,
      threadId,
      resourceId,
      stateId,
      tracking,
    });

    // The processor downstream uses contextWindow.hasSnapshot to decide whether
    // to emit a delta. When storage finds the prior snapshot, hasSnapshot must
    // be true so the delta path is reachable — even if the in-prompt window
    // does not contain the raw signal row.
    expect(history.lastSnapshot?.id).toBe('signal-snapshot-1');
    expect(history.contextWindow.hasSnapshot).toBe(true);
  });
});
