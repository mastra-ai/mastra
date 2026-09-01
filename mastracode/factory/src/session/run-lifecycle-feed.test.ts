import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import { describe, expect, it, vi } from 'vitest';

import { feedTopic } from '../feed-events.js';
import {
  observeSessionRunLifecycle,
  type RunLifecycleFeedDependencies,
  type RunLifecycleFeedSession,
} from './run-lifecycle-feed.js';

const SESSION_ID = 'session-1';
const ORG_ID = 'org-1';
const PROJECT_ID = 'project-1';

function createSession() {
  const listeners: Array<(event: AgentControllerEvent) => void> = [];
  const session: RunLifecycleFeedSession = {
    identity: { getResourceId: () => SESSION_ID },
    subscribe: listener => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) listeners.splice(index, 1);
      };
    },
  };
  const emit = (event: AgentControllerEvent) => {
    for (const listener of [...listeners]) listener(event);
  };
  return { session, emit };
}

function createDependencies({ sessionRow = true }: { sessionRow?: boolean } = {}) {
  const publish = vi.fn().mockResolvedValue(undefined);
  const getBySessionId = vi
    .fn()
    .mockResolvedValue(sessionRow ? { orgId: ORG_ID, projectRepositoryId: 'repo-1' } : null);
  const markRunEnded = vi.fn().mockResolvedValue(undefined);
  const dependencies: RunLifecycleFeedDependencies = {
    sourceControl: {
      sessions: { getBySessionId, markRunEnded },
      projectRepositories: { get: vi.fn().mockResolvedValue({ connectionId: 'connection-1' }) },
      connections: { get: vi.fn().mockResolvedValue({ factoryProjectId: PROJECT_ID }) },
    },
    pubsub: { publish },
  };
  return { dependencies, publish, getBySessionId, markRunEnded };
}

async function settled() {
  await new Promise(resolve => setImmediate(resolve));
}

describe('observeSessionRunLifecycle', () => {
  it('publishes a run frame on the project feed for agent_start and agent_end', async () => {
    const { session, emit } = createSession();
    const { dependencies, publish } = createDependencies();
    observeSessionRunLifecycle(session, dependencies);

    emit({ type: 'agent_start' });
    emit({ type: 'agent_end', reason: 'complete' });
    await settled();

    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledWith(feedTopic(ORG_ID, PROJECT_ID), {
      type: 'factory.feed.touched',
      runId: SESSION_ID,
      data: { sessionId: SESSION_ID },
    });
  });

  it('stamps the run end before its frame goes out, and never on start', async () => {
    const { session, emit } = createSession();
    const { dependencies, publish, markRunEnded } = createDependencies();
    observeSessionRunLifecycle(session, dependencies);

    emit({ type: 'agent_start' });
    await settled();
    expect(markRunEnded).not.toHaveBeenCalled();

    let stampSettled = false;
    markRunEnded.mockImplementation(async () => {
      stampSettled = true;
    });
    publish.mockImplementation(async () => {
      // A client refetching on the frame must read the stamped row.
      expect(stampSettled).toBe(true);
    });
    emit({ type: 'agent_end', reason: 'complete' });
    await settled();
    expect(markRunEnded).toHaveBeenCalledWith({ sessionId: SESSION_ID });
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it('still publishes the frame when the stamp write fails', async () => {
    const { session, emit } = createSession();
    const { dependencies, publish, markRunEnded } = createDependencies();
    markRunEnded.mockRejectedValue(new Error('db down'));
    observeSessionRunLifecycle(session, dependencies);

    emit({ type: 'agent_end', reason: 'complete' });
    await settled();
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('resolves the session project once for the session lifetime', async () => {
    const { session, emit } = createSession();
    const { dependencies, publish, getBySessionId } = createDependencies();
    observeSessionRunLifecycle(session, dependencies);

    emit({ type: 'agent_start' });
    emit({ type: 'agent_end', reason: 'complete' });
    await settled();

    expect(publish).toHaveBeenCalledTimes(2);
    expect(getBySessionId).toHaveBeenCalledTimes(1);
  });

  it('stays silent for a session with no source-control row, and retries on the next event', async () => {
    const { session, emit } = createSession();
    const { dependencies, publish, getBySessionId } = createDependencies({ sessionRow: false });
    observeSessionRunLifecycle(session, dependencies);

    emit({ type: 'agent_start' });
    await settled();
    expect(publish).not.toHaveBeenCalled();

    getBySessionId.mockResolvedValue({ orgId: ORG_ID, projectRepositoryId: 'repo-1' });
    emit({ type: 'agent_end', reason: 'complete' });
    await settled();
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('ignores every other event type', async () => {
    const { session, emit } = createSession();
    const { dependencies, publish, getBySessionId } = createDependencies();
    observeSessionRunLifecycle(session, dependencies);

    emit({ type: 'display_state_changed', displayState: { isRunning: true } } as AgentControllerEvent);
    await settled();

    expect(publish).not.toHaveBeenCalled();
    expect(getBySessionId).not.toHaveBeenCalled();
  });
});
