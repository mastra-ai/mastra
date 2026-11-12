import { stateSchema } from '@mastra/code-sdk/schema';
import type { MastraCodeState } from '@mastra/code-sdk/schema';
import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { createFactoryBackgroundNoticeDelivery } from './background-notices.js';

const signal = {
  id: 'background-process:7:call-1',
  type: 'notification' as const,
  tagName: 'notification',
  contents: 'Background command exited with code 0: pnpm dev',
};

async function startController() {
  const controller = new AgentController<MastraCodeState>({
    id: 'factory-background-notices',
    stateSchema,
    storage: new InMemoryStore({ id: 'factory-background-notices' }),
    modes: [
      {
        id: 'build',
        name: 'Build',
        default: true,
        agent: new Agent({
          id: 'test-agent',
          name: 'Test agent',
          instructions: 'Test.',
          model: { id: 'openai/gpt-5.5' },
        }),
      },
    ],
  });
  await controller.init();
  return controller;
}

describe('Factory background notices', () => {
  // A woken run has no signed-in request; without the row owner's identity it runs on nobody's credentials.
  it("wakes the session on the notice's thread as the session's owner", async () => {
    const controller = await startController();
    const session = await controller.createSession({ id: 'session-a', resourceId: 'factory-1', threadId: 'session-a' });
    const sendSignal = vi.spyOn(session, 'sendSignal').mockReturnValue({
      id: signal.id,
      type: 'notification',
      accepted: Promise.resolve({ accepted: true, action: 'wake' }),
    });
    const delivery = createFactoryBackgroundNoticeDelivery({
      getController: () => controller,
      sessions: { getBySessionId: async id => (id === 'session-a' ? { userId: 'user-1', orgId: 'org-1' } : null) },
    });

    await delivery.deliver({ resourceId: 'factory-1', threadId: 'session-a' }, signal);

    expect(sendSignal).toHaveBeenCalledTimes(1);
    const options = sendSignal.mock.calls[0]![1] as { ifIdle: unknown; requestContext: RequestContext };
    expect(options.ifIdle).toEqual({ behavior: 'wake' });
    expect(options.requestContext.get('user')).toEqual({ workosId: 'user-1', organizationId: 'org-1' });
  });

  it('holds a notice nobody can take until a session runs its thread', async () => {
    const controller = await startController();
    const delivery = createFactoryBackgroundNoticeDelivery({
      getController: () => controller,
      sessions: { getBySessionId: async () => ({ userId: 'user-1', orgId: 'org-1' }) },
    });
    await delivery.deliver({ resourceId: 'factory-1', threadId: 'session-b' }, signal, { wake: false });

    const session = await controller.createSession({ id: 'session-b', resourceId: 'factory-1', threadId: 'session-b' });
    const saved = vi.spyOn(session, 'sendSignalToThread');
    await delivery.flush();

    expect(saved).toHaveBeenCalledWith(signal, { resourceId: 'factory-1', threadId: 'session-b' });
  });
});
