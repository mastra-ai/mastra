import { describe, expect, it, vi } from 'vitest';

import { FACTORY_OPEN_RUN_SETTING, observeSessionRunEnd } from './run-end-capture.js';
import type { RunEndCaptureSession } from './run-end-capture.js';

const OPEN_RUN = { bindingId: 'binding-1', role: 'work', startedBy: 'user-1' };

function makeSession(settings: Record<string, unknown>) {
  const listeners = new Set<Parameters<RunEndCaptureSession['subscribe']>[0]>();
  const session: RunEndCaptureSession = {
    identity: { getResourceId: () => 'session-1' },
    thread: {
      getId: () => 'thread-1',
      getSetting: async ({ key }) => settings[key],
      setSetting: async ({ key, value }) => {
        settings[key] = value;
      },
    },
    mode: { get: () => 'work' },
    state: { get: () => ({ factoryOrgId: 'org-1', factoryProjectId: 'project-1' }) },
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return { session, settings, emit: (event: unknown) => listeners.forEach(listener => listener(event as never)) };
}

async function settled() {
  await new Promise(resolve => setImmediate(resolve));
}

describe('observeSessionRunEnd', () => {
  it('records how a kickoff ended once, then closes the run', async () => {
    const record = vi.fn(async () => null);
    const { session, settings, emit } = makeSession({
      factoryWorkItemId: 'item-1',
      [FACTORY_OPEN_RUN_SETTING]: OPEN_RUN,
    });
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
      metadata: {
        reason: 'error',
        ...OPEN_RUN,
        agentName: 'work agent',
        sessionId: 'session-1',
        threadId: 'thread-1',
      },
    });
    expect(settings[FACTORY_OPEN_RUN_SETTING]).toBeNull();

    emit({ type: 'agent_end', reason: 'complete' });
    await settled();
    expect(record).toHaveBeenCalledOnce();
  });

  it('keeps the run open across a suspension and ignores turns that started no run', async () => {
    const record = vi.fn(async () => null);
    const parked = makeSession({ factoryWorkItemId: 'item-1', [FACTORY_OPEN_RUN_SETTING]: OPEN_RUN });
    const humanTurn = makeSession({ factoryWorkItemId: 'item-1' });
    const chat = makeSession({ [FACTORY_OPEN_RUN_SETTING]: OPEN_RUN });
    observeSessionRunEnd(parked.session, { audit: { record } });
    observeSessionRunEnd(humanTurn.session, { audit: { record } });
    observeSessionRunEnd(chat.session, { audit: { record } });

    parked.emit({ type: 'agent_end', reason: 'suspended' });
    humanTurn.emit({ type: 'agent_end', reason: 'complete' });
    chat.emit({ type: 'agent_end', reason: 'complete' });

    await settled();
    expect(record).not.toHaveBeenCalled();
    expect(parked.settings[FACTORY_OPEN_RUN_SETTING]).toEqual(OPEN_RUN);
  });
});
