import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../../../memory/types';
import { MemoryStorage } from './base';

const notUsed = () => Promise.reject(new Error('not used'));

// An adapter written before pending signals existed: it implements only the abstract methods.
class AdapterWithoutPendingSignals extends MemoryStorage {
  getThreadById = notUsed;
  saveThread = notUsed;
  updateThread = notUsed;
  deleteThread = notUsed;
  listMessages = notUsed;
  listMessagesById = notUsed;
  saveMessages = notUsed;
  updateMessages = notUsed;
  listThreads = notUsed;
  dangerouslyClearAll = notUsed;
}

describe('MemoryStorage without pending signals', () => {
  const memory = new AdapterWithoutPendingSignals();
  const threadId = 'thread-1';
  const runId = 'run-1';
  const message = { id: 'signal-1', threadId, resourceId: 'resource-1' } as MastraDBMessage;

  it('reports no support and no sharing', () => {
    expect(memory.supportsPendingSignals).toBe(false);
    expect(memory.pendingSignalsSharedAcrossProcesses).toBe(false);
  });

  it.each([
    ['setSignalRun', () => memory.setSignalRun({ threadId, runId })],
    ['getSignalRun', () => memory.getSignalRun({ threadId })],
    ['enqueuePendingSignal', () => memory.enqueuePendingSignal({ message, toRunId: runId })],
    ['claimPendingSignals', () => memory.claimPendingSignals({ threadId, runId, consumedIds: [] })],
    ['closeSignalRun', () => memory.closeSignalRun({ threadId, runId, consumedIds: [] })],
    ['cancelPendingSignals', () => memory.cancelPendingSignals({ threadId, ids: [message.id] })],
    ['listPendingSignals', () => memory.listPendingSignals({ threadId })],
  ] as const)('rejects %s', async (_name, call) => {
    await expect(call()).rejects.toThrow(
      'Pending agent signals are not supported by this storage adapter (AdapterWithoutPendingSignals).',
    );
  });
});
