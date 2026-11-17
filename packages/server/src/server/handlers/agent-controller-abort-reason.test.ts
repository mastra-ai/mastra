import { Agent } from '@mastra/core/agent';
import { AgentController, USER_STOP_ABORT_REASON } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { Workspace } from '@mastra/core/workspace';
import { describe, it, expect, vi } from 'vitest';

import { ABORT_AGENT_CONTROLLER_SESSION_ROUTE, CREATE_AGENT_CONTROLLER_SESSION_ROUTE } from './agent-controller';

/**
 * The abort route states the reason core reports on `agent_end`, so a host can
 * settle a person's Stop as deliberate instead of retrying it. Server may only
 * type-import from `@mastra/core/agent-controller`, so it mirrors the literal:
 * asserting the route states the *imported* value is what keeps the mirror from
 * drifting away from core.
 */
describe('ABORT_AGENT_CONTROLLER_SESSION_ROUTE', () => {
  it('stops the run as a deliberate user stop', async () => {
    const storage = new InMemoryStore();
    const controller = new AgentController({
      id: 'code',
      storage,
      workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
      modes: [
        {
          id: 'build',
          name: 'Build',
          default: true,
          agent: new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any }),
        },
      ],
    });
    const mastra = new Mastra({ agentControllers: { code: controller }, storage });

    await CREATE_AGENT_CONTROLLER_SESSION_ROUTE.handler({
      mastra,
      controllerId: 'code',
      resourceId: 'stop-user',
      sessionId: 'stop-session',
    } as any);

    const session = await controller.getSession('stop-session');
    const abort = vi.spyOn(session!, 'abort');

    const res = await ABORT_AGENT_CONTROLLER_SESSION_ROUTE.handler({
      mastra,
      controllerId: 'code',
      sessionId: 'stop-session',
    } as any);

    expect(res).toEqual({ ok: true });
    expect(abort).toHaveBeenCalledWith({ reason: USER_STOP_ABORT_REASON });
  });
});
