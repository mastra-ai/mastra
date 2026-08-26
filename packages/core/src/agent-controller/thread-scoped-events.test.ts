import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';
import type { AgentControllerEvent } from './types';

function createController(storage = new InMemoryStore()) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  return new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
}

async function* textStream() {
  yield {
    type: 'data-user-message',
    runId: 'run-1',
    from: 'AGENT',
    data: { id: 'signal-1', text: 'steer note' },
  };
  yield {
    type: 'text-start',
    runId: 'run-1',
    from: 'AGENT',
    payload: { id: 't1' },
  };
  yield {
    type: 'text-delta',
    runId: 'run-1',
    from: 'AGENT',
    payload: { id: 't1', text: 'Hello there' },
  };
  yield {
    type: 'finish',
    runId: 'run-1',
    from: 'AGENT',
    payload: {
      stepResult: { reason: 'stop' },
      output: { usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      metadata: {},
    },
  };
}

function findEvent<T extends AgentControllerEvent['type']>(events: AgentControllerEvent[], type: T) {
  return events.find((event): event is Extract<AgentControllerEvent, { type: T }> => event.type === type);
}

function findEvents<T extends AgentControllerEvent['type']>(events: AgentControllerEvent[], type: T) {
  return events.filter((event): event is Extract<AgentControllerEvent, { type: T }> => event.type === type);
}

describe('thread-scoped run events', () => {
  let controller: AgentController;
  let session: Awaited<ReturnType<AgentController['createSession']>>;

  beforeEach(async () => {
    controller = createController();
    await controller.init();
    session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
  });

  it('stamps the run lifecycle events and streamed messages with the thread they run on', async () => {
    const thread = await session.thread.create();
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(event));

    await (session as any).processStream({ fullStream: textStream() });

    expect(findEvent(events, 'agent_start')?.threadId).toBe(thread.id);
    expect(findEvent(events, 'agent_end')?.threadId).toBe(thread.id);
    expect(findEvents(events, 'message_start').map(event => event.message.threadId)).toEqual([thread.id, thread.id]);
    expect(findEvents(events, 'message_end').map(event => event.message.threadId)).toEqual([thread.id, thread.id]);
  });
});
