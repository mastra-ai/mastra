import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { GENERATE_AGENT_ROUTE } from '@mastra/server/handlers/agents';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { MastraServer } from '../index';

// https://github.com/mastra-ai/mastra/issues/28760
describe('Hono request context validation failure', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('responds 400 and does not log the failure as a server error', async () => {
    const agent = new Agent({
      id: 'schema-agent',
      name: 'schema-agent',
      instructions: 'test',
      model: { specificationVersion: 'v2' } as any,
      requestContextSchema: z.object({ userId: z.string() }),
    });
    const mastra = new Mastra({ agents: { 'schema-agent': agent } });
    const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
    vi.spyOn(mastra, 'getLogger').mockReturnValue(logger as any);

    const app = new Hono();
    const adapter = new MastraServer({ app, mastra });
    app.use('*', adapter.createContextMiddleware());
    await adapter.registerRoute(app, GENERATE_AGENT_ROUTE, { prefix: '' });

    const response = await app.request(
      new Request('http://localhost/agents/schema-agent/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], requestContext: {} }),
      }),
    );

    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain('Request context validation failed');
    expect(logger.error).not.toHaveBeenCalledWith('Error calling handler', expect.anything());
  });
});
