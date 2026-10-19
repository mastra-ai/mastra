import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '../request-context';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

describe('AgentController reserved memory context', () => {
  it('overrides auth-mapped reserved memory keys with the session resource and thread', async () => {
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'test-controller',
      storage: new InMemoryStore(),
      modes: [
        {
          id: 'default',
          name: 'Default',
          default: true,
          agent: new Agent({ name: 'a', instructions: 'x', model: { provider: 'openai', name: 'gpt-4o' } }),
        },
      ],
    });
    await controller.init();
    const session = await controller.createSession({
      id: 'factory-session',
      ownerId: 'authenticated-user',
      resourceId: 'factory-session',
      threadId: 'factory-session',
    });

    const incoming = new RequestContext();
    incoming.set(MASTRA_RESOURCE_ID_KEY, 'authenticated-user');
    incoming.set(MASTRA_THREAD_ID_KEY, 'other-thread');
    incoming.set('user', { id: 'authenticated-user' });

    const built: RequestContext = await (controller as any).buildRequestContext(session, incoming);

    expect(built.get(MASTRA_RESOURCE_ID_KEY)).toBe('factory-session');
    expect(built.get(MASTRA_THREAD_ID_KEY)).toBe('factory-session');
    expect(built.get('user')).toEqual({ id: 'authenticated-user' });
    expect(incoming.get(MASTRA_RESOURCE_ID_KEY)).toBe('authenticated-user');
  });
});
