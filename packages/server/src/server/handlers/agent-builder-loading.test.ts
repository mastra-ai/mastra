import { describe, expect, it, vi } from 'vitest';

import { SERVER_ROUTES } from '../server-adapter/routes';
import { GET_AGENT_BUILDER_ACTION_BY_ID_ROUTE } from './agent-builder';

// A plain counter, because Vitest drops vi.fn() calls made while test files are collected.
const agentBuilder = vi.hoisted(() => ({ loads: 0 }));

vi.mock('@mastra/agent-builder', () => {
  agentBuilder.loads++;
  return { createAgentBuilderWorkflows: () => ({}) };
});

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

// Tests run in order: the first checks the state left by the static imports above, before any handler runs.
describe('agent builder route loading', () => {
  it('registers agent builder routes without loading @mastra/agent-builder', () => {
    expect(SERVER_ROUTES.some(route => route.path.startsWith('/agent-builder'))).toBe(true);
    expect(agentBuilder.loads).toBe(0);
  });

  it('loads agent builder when an agent builder route is handled', async () => {
    await expect(
      GET_AGENT_BUILDER_ACTION_BY_ID_ROUTE.handler({
        mastra: createMastraMock(),
        actionId: 'missing-action',
      } as any),
    ).rejects.toThrow('Invalid agent-builder action: missing-action');

    expect(agentBuilder.loads).toBe(1);
  });
});
