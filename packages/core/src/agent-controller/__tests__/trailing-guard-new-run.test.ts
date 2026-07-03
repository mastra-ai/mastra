/**
 * Regression test for the trailing-data guard in processSubscribedThreadStream.
 *
 * When a run finishes, `lastFinishedRunId` is set. If a *new* run then starts
 * with a different runId, null-runId chunks from the new run (like
 * `data-user-message`) must NOT be skipped by the trailing guard.
 *
 * Root cause:
 *   - Finish for runId A → lastFinishedRunId = A
 *   - Start for runId B → creates new run, but lastFinishedRunId stays A
 *   - data-user-message (runId=null) → SKIPPED because null matches trailing guard
 *
 * Fix: clear lastFinishedRunId when creating a new run (`!currentRun` branch).
 */
import { describe, it, expect } from 'vitest';
import { Agent } from '../../agent';
import { InMemoryStore } from '../../storage/mock';
import { AgentController } from '../agent-controller';
import type { Session } from '../session';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerEvent } from '../types';

function createController() {
  const agent = new Agent({
    id: 'trailing-guard-agent',
    name: 'trailing-guard-agent',
    instructions: 'Test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' } as any,
  });

  return new AgentController({
    workspace: createMockWorkspace(),
    id: 'trailing-guard-controller',
    storage: new InMemoryStore(),
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
}

async function processSubscribedChunks(session: Session<any>, chunks: any[], activeRunId = 'run-b') {
  const subscription = {
    stream: (async function* () {
      for (const chunk of chunks) yield chunk;
    })(),
    activeRunId: () => activeRunId,
    abort: () => {},
    unsubscribe: () => {},
  };

  session.stream.attach({ subscription: subscription as any, key: 'test-agent:test-resource:test-thread' });
  await session.processSubscribedThreadStream(subscription as any);
}

describe('Trailing guard does not swallow new-run null-runId chunks', () => {
  it('delivers null-runId chunks from a new run after a different run was aborted', async () => {
    const controller = createController();
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    // Track which chunk types reach processStreamChunk.
    const processedChunkTypes: string[] = [];
    const origProcessStreamChunk = session.runEngine.processStreamChunk.bind(session.runEngine);
    session.runEngine.processStreamChunk = async (state: any, chunk: any, requestContext: any) => {
      processedChunkTypes.push(chunk?.type ?? 'unknown');
      return origProcessStreamChunk(state, chunk, requestContext);
    };

    await processSubscribedChunks(session, [
      // --- Run A: starts, then finishes ---
      { type: 'start', runId: 'run-a' },
      { type: 'finish', runId: 'run-a', payload: { stepResult: { reason: 'stop' } } },

      // --- Run B: starts with a different runId ---
      { type: 'start', runId: 'run-b' },
      // Null-runId chunks from the new run — these must NOT be skipped:
      { type: 'data-user-message', data: { content: 'User message for run B' } },
      { type: 'data-om-status', data: { status: 'ready' } },
      { type: 'finish', runId: 'run-b', payload: { stepResult: { reason: 'stop' } } },
    ]);

    // Both runs should produce agent_start events.
    const agentStarts = events.filter(e => e.type === 'agent_start');
    expect(agentStarts.length).toBe(2);

    // Both runs should end cleanly.
    const completedEnds = events.filter(e => e.type === 'agent_end' && e.reason === 'complete');
    expect(completedEnds.length).toBe(2);

    // The null-runId chunks from run B must have been processed, not skipped.
    expect(processedChunkTypes).toContain('data-user-message');
    expect(processedChunkTypes).toContain('data-om-status');
  });
});
