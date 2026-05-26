import { afterEach, describe, expect, it, vi } from 'vitest';

function createMastraMock() {
  const logger = {
    info: vi.fn(),
    error: vi.fn(),
  };

  return {
    getLogger: () => logger,
    getStorage: vi.fn(),
    listAgents: () => ({}),
    getTTS: vi.fn(),
    listVectors: () => ({}),
  };
}

describe('agent builder route loading', () => {
  afterEach(() => {
    vi.doUnmock('@mastra/agent-builder');
    vi.resetModules();
  });

  it('registers agent builder routes without loading @mastra/agent-builder', { timeout: 10_000 }, async () => {
    const loadAgentBuilder = vi.fn(() => ({
      agentBuilderWorkflows: {},
    }));

    vi.doMock('@mastra/agent-builder', loadAgentBuilder);

    const routes = await import('../server-adapter/routes');

    expect(routes.SERVER_ROUTES.some(route => route.path.startsWith('/agent-builder'))).toBe(true);
    expect(loadAgentBuilder).not.toHaveBeenCalled();
  });

  it('loads agent builder when an agent builder route is handled', async () => {
    const loadAgentBuilder = vi.fn(() => ({
      agentBuilderWorkflows: {},
    }));

    vi.doMock('@mastra/agent-builder', loadAgentBuilder);

    const { GET_AGENT_BUILDER_ACTION_BY_ID_ROUTE } = await import('./agent-builder');

    await expect(
      GET_AGENT_BUILDER_ACTION_BY_ID_ROUTE.handler({
        mastra: createMastraMock(),
        actionId: 'missing-action',
      } as any),
    ).rejects.toThrow('Invalid agent-builder action: missing-action');

    expect(loadAgentBuilder).toHaveBeenCalledTimes(1);
  });
});
