import { describe, expect, it, vi } from 'vitest';

import { observeSessionRunEnd } from './run-end-capture.js';
import type { RunEndCaptureSession } from './run-end-capture.js';

function makeSession(settings: Record<string, unknown>) {
  const listeners = new Set<Parameters<RunEndCaptureSession['subscribe']>[0]>();
  const session: RunEndCaptureSession = {
    identity: { getResourceId: () => 'session-1' },
    thread: { getId: () => 'thread-1', getSetting: async ({ key }) => settings[key] },
    state: { get: () => ({ factoryOrgId: 'org-1', factoryProjectId: 'project-1' }) },
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return { session, emit: (event: unknown) => listeners.forEach(listener => listener(event as never)) };
}

describe('observeSessionRunEnd', () => {
  it('records how a bound run ended, against its work item', async () => {
    const record = vi.fn(async () => null);
    const { session, emit } = makeSession({ factoryWorkItemId: 'item-1' });
    observeSessionRunEnd(session, { audit: { record } });

    emit({ type: 'agent_end', reason: 'error' });

    await vi.waitFor(() => expect(record).toHaveBeenCalledOnce());
    expect(record).toHaveBeenCalledWith({
      orgId: 'org-1',
      factoryProjectId: 'project-1',
      actorId: 'agent:thread-1',
      actorType: 'agent',
      action: 'factory.run.ended',
      targets: [{ type: 'work_item', id: 'item-1' }],
      metadata: { reason: 'error', sessionId: 'session-1', threadId: 'thread-1' },
    });
  });

  it('ignores a parked run and a session bound to no work item', async () => {
    const record = vi.fn(async () => null);
    const bound = makeSession({ factoryWorkItemId: 'item-1' });
    const chat = makeSession({});
    observeSessionRunEnd(bound.session, { audit: { record } });
    observeSessionRunEnd(chat.session, { audit: { record } });

    bound.emit({ type: 'agent_end', reason: 'suspended' });
    chat.emit({ type: 'agent_end', reason: 'complete' });

    await new Promise(resolve => setImmediate(resolve));
    expect(record).not.toHaveBeenCalled();
  });
});
