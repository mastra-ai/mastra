import type { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { createHonoServer } from '@mastra/deployer/server';
import { describe, expect, it, vi } from 'vitest';

import {
  createOrganizationAnswerRoute,
  createOrganizationTelemetryRoute,
} from '../../../src/mastra/api/organization.js';
import type { SourceIndex } from '../../../src/mastra/workspaces/source-index.js';

describe('organization HTTP authentication', () => {
  it.each([
    { authenticated: true, isDev: false },
    { authenticated: true, isDev: true },
    { authenticated: false, isDev: true },
  ])('protects both routes according to server configuration: %j', async ({ authenticated, isDev }) => {
    const generate = vi.fn().mockRejectedValue(new Error('synthetic provider failure'));
    const summary = vi.fn().mockResolvedValue({ syncRuns: 0 });
    const mastra = new Mastra({
      logger: false,
      server: {
        ...(authenticated
          ? {
              auth: {
                authenticateToken: async (token: string) => (token === 'synthetic-token' ? { id: 'member' } : null),
              },
            }
          : {}),
        apiRoutes: [
          createOrganizationAnswerRoute({ generate } as unknown as Agent),
          createOrganizationTelemetryRoute({ telemetry: { summary } } as unknown as SourceIndex),
        ],
      },
    });
    const app = await createHonoServer(mastra, { tools: {}, isDev, studio: false });
    for (const [path, method, callback] of [
      ['/organization-answer', 'POST', generate],
      ['/organization-telemetry', 'GET', summary],
    ] as const) {
      const request = (authorization?: string) =>
        app.request(path, {
          method,
          headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
          ...(method === 'POST' ? { body: JSON.stringify({ question: 'What is the policy?' }) } : {}),
        });
      if (authenticated) {
        expect((await request()).status).toBe(401);
        expect((await request('Bearer invalid-token')).status).toBe(401);
        expect(callback).not.toHaveBeenCalled();
        expect((await request('Bearer synthetic-token')).status).toBe(200);
      } else {
        expect((await request()).status).toBe(200);
      }
      expect(callback).toHaveBeenCalledTimes(1);
    }
  });
});
