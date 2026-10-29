import type { Server } from 'node:http';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { GENERATE_AGENT_ROUTE } from '@mastra/server/handlers/agents';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { MastraServer } from '../index';

// https://github.com/mastra-ai/mastra/issues/28760
describe('Koa request context validation failure', () => {
  let server: Server | null = null;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (server) {
      await new Promise<void>((resolve, reject) => server!.close(err => (err ? reject(err) : resolve())));
      server = null;
    }
  });

  it('responds 400 and does not log the failure as a server error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
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

    const app = new Koa();
    const adapter = new MastraServer({ app, mastra });
    (adapter as any).registerErrorMiddleware();
    app.use(bodyParser());
    app.use(adapter.createContextMiddleware());
    await adapter.registerRoute(app, GENERATE_AGENT_ROUTE, { prefix: '' });

    server = await new Promise(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const response = await fetch(`http://localhost:${port}/agents/schema-agent/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], requestContext: {} }),
    });

    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain('Request context validation failed');
    expect(logger.error).not.toHaveBeenCalledWith('Error calling handler', expect.anything());
    expect(consoleError).not.toHaveBeenCalled();
  });
});
