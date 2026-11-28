import { describe, expect, it } from 'vitest';
import { Agent } from '../../agent';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';

function createController(memory: () => MockMemory) {
  const agent = new Agent({
    id: 'thread-row-agent',
    name: 'Thread row agent',
    instructions: 'Answer directly.',
    model: new MastraLanguageModelV2Mock({}),
  });
  return new AgentController({
    workspace: createMockWorkspace(),
    id: 'thread-row-controller',
    storage: new InMemoryStore(),
    memory,
    modes: [{ id: 'default', name: 'Default', default: true, defaultModelId: 'openai/gpt-5.5', agent }],
  });
}

describe('AgentController thread row reads', () => {
  it('reads a controller thread row without resolving a memory factory that needs a caller', async () => {
    // The host's factory resolves fine while a run has bound its caller and
    // throws without one, like a tenant credential policy.
    let callerBound = true;
    let factoryCallsWithoutCaller = 0;
    const memory = new MockMemory();
    const controller = createController(() => {
      if (callerBound) return memory;
      factoryCallsWithoutCaller++;
      throw new Error('Tenant model credential policy could not be resolved: the request has no authenticated user.');
    });
    await controller.init();
    const session = await controller.createSession({ id: 'session-a', ownerId: 'owner-a' });
    const threadId = session.thread.getId()!;
    callerBound = false;

    const row = await session.thread.getById({ threadId });

    expect(row?.id).toBe(threadId);
    expect(factoryCallsWithoutCaller).toBe(0);
  });

  it('treats a controller storage miss as a miss without resolving a memory factory that needs a caller', async () => {
    let callerBound = true;
    let factoryCallsWithoutCaller = 0;
    const memory = new MockMemory();
    const controller = createController(() => {
      if (callerBound) return memory;
      factoryCallsWithoutCaller++;
      throw new Error('Tenant model credential policy could not be resolved: the request has no authenticated user.');
    });
    await controller.init();
    const session = await controller.createSession({ id: 'session-a', ownerId: 'owner-a' });
    callerBound = false;

    await expect(session.thread.getById({ threadId: 'not-created-yet' })).resolves.toBeNull();
    expect(factoryCallsWithoutCaller).toBe(0);
  });
});
