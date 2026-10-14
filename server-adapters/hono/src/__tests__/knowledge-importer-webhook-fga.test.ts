import type { IFGAProvider } from '@mastra/core/auth/ee';
import { Mastra } from '@mastra/core/mastra';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { MastraServer } from '../index';

// Over real HTTP: the built-in Knowledge importer webhook route must consult FGA before it reaches the handler.
async function post(allowed: boolean) {
  const check = vi.fn().mockResolvedValue(allowed);
  const fga: IFGAProvider = { check, require: vi.fn(), filterAccessible: vi.fn() };
  const mastra = new Mastra({
    logger: false,
    server: {
      fga,
      middleware: [
        async (c, next) => {
          c.get('requestContext').set('user', { id: 'other-org-user' });
          await next();
        },
      ],
    },
  });
  const app = new Hono();
  await new MastraServer({ app, mastra }).init();
  const response = await app.request('http://localhost/api/knowledge/default/importers/calendar/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ payload: {} }),
  });
  return { response, check };
}

describe('Knowledge importer webhook FGA over HTTP', () => {
  it('denies with 403 when the FGA provider refuses, checking the importer resource', async () => {
    const { response, check } = await post(false);
    expect(response.status).toBe(403);
    expect(check).toHaveBeenCalledTimes(1);
    expect(check).toHaveBeenCalledWith(
      { id: 'other-org-user' },
      expect.objectContaining({
        resource: { type: 'knowledge-importer', id: JSON.stringify(['default', 'calendar']) },
        permission: 'knowledge:write',
      }),
    );
  });

  it('reaches the handler when the FGA provider allows', async () => {
    const { response, check } = await post(true);
    expect(check).toHaveBeenCalledTimes(1);
    // No Knowledge instance is registered, so an authorized request falls through to the handler's 404.
    expect(response.status).toBe(404);
  });
});
