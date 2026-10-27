import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { MockStore } from '@mastra/core/storage';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MASTRA_AUTH_MODE_KEY } from '../constants';
import { createTestServerContext } from './test-utils';
import { getHandlerFGAProvider } from './utils';
import { LIST_WORKFLOWS_ROUTE } from './workflows';

function buildMastra() {
  const step = createStep({
    id: 's',
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    execute: async () => ({}),
  });
  const workflow = (id: string) =>
    createWorkflow({ id, inputSchema: z.object({}), outputSchema: z.object({}), steps: [step] })
      .then(step)
      .commit();
  return new Mastra({
    logger: false,
    storage: new MockStore(),
    workflows: { allowed: workflow('allowed'), hidden: workflow('hidden') },
  });
}

function providers(config: { server?: boolean; studio?: boolean }) {
  const serverFga = { filterAccessible: vi.fn(async (_user: unknown, items: any[]) => items.slice(0, 1)) };
  const studioFga = { filterAccessible: vi.fn(async (_user: unknown, items: any[]) => items.slice(1)) };
  const mastra = buildMastra();
  vi.spyOn(mastra, 'getServer').mockReturnValue((config.server ? { fga: serverFga } : {}) as any);
  vi.spyOn(mastra, 'getStudio').mockReturnValue((config.studio ? { fga: studioFga } : undefined) as any);
  return { mastra, serverFga, studioFga };
}

function contextFor(authMode?: 'studio' | 'server') {
  const requestContext = new RequestContext();
  requestContext.set('user', { id: 'user-1' });
  if (authMode) requestContext.set(MASTRA_AUTH_MODE_KEY, authMode);
  return requestContext;
}

describe('handler FGA provider selection', () => {
  it('uses the studio provider for studio-auth requests when one is configured', async () => {
    const { mastra, serverFga, studioFga } = providers({ server: true, studio: true });

    const result = await LIST_WORKFLOWS_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      requestContext: contextFor('studio'),
    });

    expect(Object.keys(result)).toEqual(['hidden']);
    expect(studioFga.filterAccessible).toHaveBeenCalledTimes(1);
    expect(serverFga.filterAccessible).not.toHaveBeenCalled();
  });

  it('applies a studio-only provider to studio-auth requests', async () => {
    const { mastra, studioFga } = providers({ studio: true });

    const result = await LIST_WORKFLOWS_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      requestContext: contextFor('studio'),
    });

    expect(Object.keys(result)).toEqual(['hidden']);
    expect(studioFga.filterAccessible).toHaveBeenCalledTimes(1);
  });

  it('uses the server provider for server-auth requests', async () => {
    const { mastra, serverFga, studioFga } = providers({ server: true, studio: true });

    const result = await LIST_WORKFLOWS_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      requestContext: contextFor('server'),
    });

    expect(Object.keys(result)).toEqual(['allowed']);
    expect(serverFga.filterAccessible).toHaveBeenCalledTimes(1);
    expect(studioFga.filterAccessible).not.toHaveBeenCalled();
  });

  it('falls back to the server provider for studio-auth requests when no studio provider is configured', async () => {
    const { mastra, serverFga } = providers({ server: true });

    const result = await LIST_WORKFLOWS_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      requestContext: contextFor('studio'),
    });

    expect(Object.keys(result)).toEqual(['allowed']);
    expect(serverFga.filterAccessible).toHaveBeenCalledTimes(1);
  });

  it('denies, rather than allows, when FGA is configured but no provider applies to the request', async () => {
    const { mastra, studioFga } = providers({ studio: true });

    await expect(
      LIST_WORKFLOWS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        requestContext: contextFor('server'),
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(studioFga.filterAccessible).not.toHaveBeenCalled();
  });

  it('leaves requests unrestricted when no FGA provider is configured', async () => {
    const { mastra } = providers({});

    const result = await LIST_WORKFLOWS_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      requestContext: contextFor('server'),
    });

    expect(Object.keys(result).sort()).toEqual(['allowed', 'hidden']);
    expect(getHandlerFGAProvider(mastra, contextFor('server'))).toBeUndefined();
  });
});
