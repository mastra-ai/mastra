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

  async function startServer() {
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
    const send = () =>
      fetch(`http://localhost:${port}/agents/schema-agent/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], requestContext: {} }),
      });
    return { app, logger, send };
  }

  it('responds 400 and does not log the failure as a server error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { logger, send } = await startServer();

    const response = await send();

    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain('Request context validation failed');
    expect(logger.error).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('delivers the 400 to an app error listener added after listen without console.error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { app, send } = await startServer();
    const appListener = vi.fn();
    app.on('error', appListener);

    const response = await send();

    expect(response.status).toBe(400);
    expect(appListener).toHaveBeenCalledTimes(1);
    expect(appListener.mock.calls[0]![0]).toMatchObject({ status: 400 });
    expect(consoleError).not.toHaveBeenCalled();
  });
});
