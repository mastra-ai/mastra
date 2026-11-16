/**
 * A pre-suspension flush that fails surfaces an `error` chunk so the caller does not see a
 * normal completion for a call memory never received. That failure is scoped to the tool call
 * it names: a parallel call in the same step that already published and persisted its
 * suspension must stay resumable. An unscoped error still ends the run and retracts every
 * suspension parked on it.
 */
import { describe, it, expect, vi } from 'vitest';
import { Agent } from '../../agent';
import { InMemoryStore } from '../../storage/mock';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerEvent } from '../types';

vi.setConfig({ testTimeout: 30_000 });

async function createSession() {
  const agent = new Agent({
    id: 'flush-failure-scope-agent',
    name: 'flush-failure-scope-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'flush-failure-scope-controller',
    storage: new InMemoryStore(),
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
  await controller.init();
  const session = await controller.createSession({ id: 'flush-failure-scope-session', ownerId: 'test-owner' });
  const thread = await session.thread.create({ id: 'flush-failure-scope-thread' });

  const events: AgentControllerEvent[] = [];
  session.subscribe(event => events.push(event));

  session.run.ensureAbortController();
  session.run.setRunId({ runId: 'flush-scope-run' });
  const runId = session.run.getRunId()!;
  // call-a already published and persisted its suspension, so the client was told about it.
  session.suspensions.register({
    toolCallId: 'call-a',
    runId,
    toolName: 'suspendA',
    threadId: thread.id,
    resourceId: session.identity.getResourceId(),
  });

  return { session, events, runId };
}

function errorChunk(runId: string, payload: Record<string, unknown>) {
  return { type: 'error', runId, from: 'AGENT' as const, payload };
}

describe('AgentController: a flush failure is scoped to its own tool call', () => {
  it('keeps a sibling suspension parked when the error chunk names another call', async () => {
    const { session, events, runId } = await createSession();

    await (session as any).processStream({
      fullStream: (async function* () {
        yield errorChunk(runId, {
          error: new Error('Failed to save the suspended tool call: storage unavailable'),
          toolCallId: 'call-b',
        });
      })(),
    });

    // The failure is still reported to the session...
    expect(events.some(e => e.type === 'error')).toBe(true);
    // ...but it belongs to call-b only: retracting call-a would cancel a suspension the
    // client was already told about and can still resume.
    expect(events.filter(e => e.type === 'tool_suspension_cancelled')).toEqual([]);
    expect(session.suspensions.has({ toolCallId: 'call-a', runId })).toBe(true);
  });

  it('still retracts every parked suspension for an unscoped error', async () => {
    const { session, events, runId } = await createSession();

    await (session as any).processStream({
      fullStream: (async function* () {
        yield errorChunk(runId, { error: new Error('the provider stream died') });
      })(),
    });

    expect(
      events.filter(e => e.type === 'tool_suspension_cancelled').map(e => (e as { toolCallId: string }).toolCallId),
    ).toEqual(['call-a']);
    expect(session.suspensions.has({ toolCallId: 'call-a', runId })).toBe(false);
  });
});
