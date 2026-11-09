import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';
import { configureComputerServer, InMemoryComputerTicketStore } from '../computer-stream';
import { computerSessionForbiddenResponseSchema, createComputerSessionResponseSchema } from '../schemas/computers';
import {
  CHANGE_COMPUTER_CONTROL_ROUTE,
  CREATE_COMPUTER_SESSION_ROUTE,
  GET_COMPUTER_CONTROL_ROUTE,
} from './computers';

function setup() {
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_RESOURCE_ID_KEY, 'resource');
  requestContext.set(MASTRA_THREAD_ID_KEY, 'thread');
  const viewer = vi.fn().mockResolvedValue({ url: 'https://viewer.test/vnc.html', headers: { cookie: 'secret' } });
  const controlState = vi.fn().mockResolvedValue({ holder: 'agent', revision: 0 });
  const control = vi.fn().mockResolvedValue({ holder: 'human', revision: 1, notified: true });
  const getThreadById = vi.fn().mockResolvedValue({ id: 'thread', resourceId: 'resource' });
  const mastra = {
    getComputers: () => ({ viewer, controlState, control }),
    getStorage: () => ({ getStore: async (name: string) => (name === 'memory' ? { getThreadById } : undefined) }),
    getServer: () => undefined,
    getStudio: () => undefined,
  } as any;
  const ticketStore = new InMemoryComputerTicketStore();
  configureComputerServer(mastra, { ticketStore });
  return { mastra, requestContext, ticketStore, viewer, controlState, control, getThreadById };
}

async function invoke(route: any, input: Record<string, unknown>) {
  return route.handler(input);
}

describe('computer server routes', () => {
  it('declares every JSON route authenticated', () => {
    expect(CREATE_COMPUTER_SESSION_ROUTE.requiresAuth).toBe(true);
    expect(GET_COMPUTER_CONTROL_ROUTE.requiresAuth).toBe(true);
    expect(CHANGE_COMPUTER_CONTROL_ROUTE.requiresAuth).toBe(true);
  });

  it('documents forbidden sessions as HTTP errors instead of success states', () => {
    expect(createComputerSessionResponseSchema.safeParse({ state: 'forbidden' }).success).toBe(false);
    expect(computerSessionForbiddenResponseSchema.safeParse({ error: 'Forbidden' }).success).toBe(true);
    expect(CREATE_COMPUTER_SESSION_ROUTE.openapi?.responses[403]).toEqual({
      description: 'The authenticated caller cannot access the requested computer thread.',
      content: { 'application/json': { schema: computerSessionForbiddenResponseSchema } },
    });
  });

  it('mints an origin-bound single-use viewer ticket without exposing viewer headers', async () => {
    const { mastra, requestContext, ticketStore } = setup();
    const result = await invoke(CREATE_COMPUTER_SESSION_ROUTE, {
      mastra,
      requestContext,
      request: new Request('https://studio.test/api/computers/c1/session', {
        method: 'POST',
        headers: { origin: 'https://studio.test' },
      }),
      computerId: 'c1',
      mode: 'control',
    });
    expect(result).toEqual({ state: 'ready', socketUrl: expect.stringMatching(/^\/computer\/c1\/websockify\?ticket=/) });
    expect(JSON.stringify(result)).not.toContain('secret');
    const ticket = new URL(`https://studio.test${result.socketUrl}`).searchParams.get('ticket')!;
    await expect(ticketStore.consume(ticket, 'c1')).resolves.toEqual({
      computerId: 'c1',
      threadId: 'thread',
      resourceId: 'resource',
      mode: 'control',
      studioOrigin: 'https://studio.test',
    });
    await expect(ticketStore.consume(ticket, 'c1')).resolves.toBeUndefined();
  });

  it('hides unknown threads, mismatched resources, and foreign origins as not found', async () => {
    const { mastra, requestContext, getThreadById } = setup();
    getThreadById.mockResolvedValueOnce(undefined);
    await expect(
      invoke(GET_COMPUTER_CONTROL_ROUTE, { mastra, requestContext, computerId: 'c1' }),
    ).rejects.toMatchObject({ status: 404 });

    const untrusted = new RequestContext();
    untrusted.set(MASTRA_RESOURCE_ID_KEY, 'other');
    untrusted.set(MASTRA_THREAD_ID_KEY, 'thread');
    await expect(
      invoke(CHANGE_COMPUTER_CONTROL_ROUTE, {
        mastra,
        requestContext: untrusted,
        computerId: 'c1',
        action: 'take',
        resourceId: 'resource',
      }),
    ).rejects.toMatchObject({ status: 404 });

    await expect(
      invoke(CREATE_COMPUTER_SESSION_ROUTE, {
        mastra,
        requestContext,
        request: new Request('https://studio.test/api/computers/c1/session', {
          method: 'POST',
          headers: { origin: 'https://evil.test' },
        }),
        computerId: 'c1',
        mode: 'watch',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('reads and changes control through the generic computer contract', async () => {
    const { mastra, requestContext, controlState, control } = setup();
    await expect(invoke(GET_COMPUTER_CONTROL_ROUTE, { mastra, requestContext, computerId: 'c1' })).resolves.toEqual({
      holder: 'agent',
      revision: 0,
    });
    await expect(
      invoke(CHANGE_COMPUTER_CONTROL_ROUTE, {
        mastra,
        requestContext,
        computerId: 'c1',
        action: 'take',
        note: 'login',
      }),
    ).resolves.toEqual({ holder: 'human', revision: 1, notified: true });
    expect(controlState).toHaveBeenCalledWith('c1', { threadId: 'thread', resourceId: 'resource' });
    expect(control).toHaveBeenCalledWith(
      'c1',
      { threadId: 'thread', resourceId: 'resource' },
      { action: 'take', note: 'login' },
    );
  });
});
