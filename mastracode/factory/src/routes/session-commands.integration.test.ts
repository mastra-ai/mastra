import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentController } from '@mastra/core/agent-controller';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { sessionCommandsRoute } from './session-command-contract.js';
import { assembleFactoryApiRoutes } from './surface.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

/**
 * Host-level contract check: the route strings the browser builds through
 * `sessionCommandsRoute()` must resolve against the REAL assembled Factory
 * surface — not a hand-mocked path in a per-route test app.
 */

function createIntegrationHarness(options: {
  getSessionByResource: (resourceId: string, scope?: string) => Promise<unknown>;
  pluginCommandPaths?: string[];
}) {
  const app = new Hono();
  mountApiRoutes(
    app as never,
    assembleFactoryApiRoutes({
      controllerId: 'code',
      controller: { getSessionByResource: options.getSessionByResource } as unknown as AgentController<MastraCodeState>,
      auth: fakeRouteAuth({ enabled: false }),
      authStorage: {} as never,
      audit: { emit: vi.fn() } as never,
      publicOrigin: 'http://localhost',
      fleet: {} as never,
      integrationStorage: {} as never,
      sourceControlStorage: { forIntegration: () => ({ sessions: {} }) } as never,
      domains: {
        intake: {} as never,
        modelCredentials: {} as never,
        memorySettings: {} as never,
        customProviders: {} as never,
        filesystem: {} as never,
        modelPacks: {} as never,
        projects: {} as never,
        queueHealth: {} as never,
        workItems: {} as never,
        channelIdentity: {} as never,
      },
      intakeReady: false,
      factoryReady: false,
      knowledgeEnabled: false,
      rules: {} as never,
      pluginPaths: {
        getCommandPaths: () => options.pluginCommandPaths ?? [],
        getSkillPaths: () => [],
      },
      includeRuntimeGlobals: false,
    }),
  );
  return app;
}

describe('assembled factory surface serves the browser session-command contract', () => {
  it('answers the exact discover URL the SPA builds', async () => {
    const workspace = {
      filesystem: {
        exists: async () => false,
        readdir: async () => [],
        readFile: async () => '',
      },
      skills: undefined,
    };
    const getSessionByResource = vi.fn(async () => ({
      state: { get: () => ({ configDir: '.mastracode' }) },
      getWorkspace: () => workspace,
    }));
    const app = createIntegrationHarness({ getSessionByResource });

    // Same string the browser service computes.
    const url = sessionCommandsRoute('code', 'discover');
    expect(url).toBe('/web/agent-controller/code/commands/discover');

    const response = await app.request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ resourceId: 'resource-1' }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { capabilities: unknown; commands: unknown[] };
    expect(body.capabilities).toEqual({ customCommands: 'supported', skills: 'unsupported' });
  });

  it('answers the exact prepare URL the SPA builds and rejects unknown tokens', async () => {
    const getSessionByResource = vi.fn(async () => undefined);
    const app = createIntegrationHarness({ getSessionByResource });

    const url = sessionCommandsRoute('code', 'prepare');
    expect(url).toBe('/web/agent-controller/code/commands/prepare');

    const response = await app.request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ resourceId: 'resource-1', command: '//missing' }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: 'session_not_found',
      message: 'Agent controller session not found.',
    });
  });
});
