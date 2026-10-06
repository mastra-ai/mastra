import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../../agent';
import { FGADeniedError } from '../../auth/ee/fga-check';
import type { IFGAProvider } from '../../auth/ee/interfaces/fga';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage/mock';
import { createMockModel } from '../../test-utils/llm-mock';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';

function createProvider(authorized: boolean): IFGAProvider {
  return {
    check: vi.fn().mockResolvedValue(authorized),
    require: authorized
      ? vi.fn().mockResolvedValue(undefined)
      : vi
          .fn()
          .mockRejectedValue(
            new FGADeniedError(
              { id: 'user-1' },
              { type: 'agent-controller', id: 'test-controller' },
              'agent-controller:execute',
            ),
          ),
    filterAccessible: vi.fn(),
  };
}

function createRequestContext() {
  const requestContext = new RequestContext();
  requestContext.set('user', { id: 'user-1', organizationMembershipId: 'om-1' });
  requestContext.set('actor', { type: 'user', id: 'user-1', organizationId: 'org-1' });
  return requestContext;
}

function createController(provider?: IFGAProvider) {
  const controller = new AgentController({
    id: 'test-controller',
    storage: new InMemoryStore(),
    workspace: createMockWorkspace(),
    modes: [
      {
        id: 'build',
        name: 'Build',
        default: true,
        agent: new Agent({
          id: 'test-agent',
          name: 'test-agent',
          instructions: 'test',
          model: createMockModel({ mockText: 'ok' }),
        }),
        defaultModelId: 'openai/gpt-4o',
      },
    ],
  });
  if (provider) {
    controller.__registerMastra({ getServer: () => ({ fga: provider }) } as any);
  }
  return controller;
}

describe('AgentController FGA', () => {
  it('denies session creation before registering or notifying a session', async () => {
    const provider = createProvider(false);
    const controller = createController(provider);
    const created = vi.fn();
    controller.onSessionCreated(created);

    await expect(
      controller.createSession({ resourceId: 'resource-1', requestContext: createRequestContext() }),
    ).rejects.toBeInstanceOf(FGADeniedError);

    expect(created).not.toHaveBeenCalled();
    expect(await controller.getSessionByResource('resource-1')).toBeUndefined();
    expect(provider.require).toHaveBeenCalledWith(
      { id: 'user-1', organizationMembershipId: 'om-1' },
      expect.objectContaining({
        resource: { type: 'agent-controller', id: 'test-controller' },
        permission: 'agent-controller:execute',
      }),
    );
  });

  it('denies direct message dispatch before invoking the agent', async () => {
    const controller = createController();
    const session = await controller.createSession({ resourceId: 'resource-1' });
    const sendSignal = vi.spyOn(session.machinery.getAgent(), 'sendSignal');
    const provider = createProvider(false);
    controller.__registerMastra({ getServer: () => ({ fga: provider }) } as any);

    await expect(
      session.sendMessage({ content: 'hello', requestContext: createRequestContext() }),
    ).rejects.toBeInstanceOf(FGADeniedError);

    expect(sendSignal).not.toHaveBeenCalled();
    expect(provider.require).toHaveBeenCalledWith(
      { id: 'user-1', organizationMembershipId: 'om-1' },
      expect.objectContaining({ permission: 'agent-controller:execute' }),
    );
  });

  it('denies queued messages before invoking the agent', async () => {
    const controller = createController();
    const session = await controller.createSession({ resourceId: 'resource-1' });
    const queueMessage = vi.spyOn(session.machinery.getAgent(), 'queueMessage');
    const provider = createProvider(false);
    controller.__registerMastra({ getServer: () => ({ fga: provider }) } as any);

    await expect(
      session.queueMessage({ content: 'hello', requestContext: createRequestContext() }),
    ).rejects.toBeInstanceOf(FGADeniedError);

    expect(queueMessage).not.toHaveBeenCalled();
    expect(provider.require).toHaveBeenCalledWith(
      { id: 'user-1', organizationMembershipId: 'om-1' },
      expect.objectContaining({ permission: 'agent-controller:execute' }),
    );
  });

  it('denies notification signals before invoking the agent', async () => {
    const controller = createController();
    const session = await controller.createSession({ resourceId: 'resource-1' });
    const sendNotificationSignal = vi.spyOn(session.machinery.getAgent(), 'sendNotificationSignal');
    const provider = createProvider(false);
    controller.__registerMastra({ getServer: () => ({ fga: provider }) } as any);

    await expect(
      session.sendNotificationSignal(
        { source: 'test', kind: 'manual', summary: 'test notification', payload: {} },
        { requestContext: createRequestContext() },
      ),
    ).rejects.toBeInstanceOf(FGADeniedError);

    expect(sendNotificationSignal).not.toHaveBeenCalled();
    expect(provider.require).toHaveBeenCalledWith(
      { id: 'user-1', organizationMembershipId: 'om-1' },
      expect.objectContaining({ permission: 'agent-controller:execute' }),
    );
  });

  it('authorizes actor-aware session reads before returning protected data', async () => {
    const controller = createController();
    const session = await controller.createSession({ resourceId: 'resource-1' });
    const provider = createProvider(true);
    controller.__registerMastra({ getServer: () => ({ fga: provider }) } as any);

    await expect(controller.getSessionByResource('resource-1', undefined, createRequestContext())).resolves.toBe(
      session,
    );
    expect(provider.require).toHaveBeenCalledWith(
      { id: 'user-1', organizationMembershipId: 'om-1' },
      expect.objectContaining({
        resource: { type: 'agent-controller', id: 'test-controller' },
        permission: 'agent-controller:read',
      }),
    );
  });

  it('preserves behavior without an FGA provider', async () => {
    const controller = createController();
    await expect(
      controller.createSession({ resourceId: 'resource-1', requestContext: createRequestContext() }),
    ).resolves.toBeDefined();
  });
});
