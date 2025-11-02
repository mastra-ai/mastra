import type { Server } from 'node:http';
import { Mastra } from '@mastra/core/mastra';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createExpressApp, startExpressServer } from './index';

const activeServers: Server[] = [];

afterEach(async () => {
  while (activeServers.length > 0) {
    const server = activeServers.pop();
    if (!server) continue;
    await new Promise(resolve => server.close(resolve));
  }
});

describe('createExpressApp', () => {
  it('responds to core Mastra routes', async () => {
    const mastra = new Mastra();
    const app = await createExpressApp(mastra, { tools: {} });

    const response = await request(app).get('/api');

    expect(response.status).toBe(200);
    expect(response.text).toContain('Mastra API');
  });

  it('supports mounting on a custom path', async () => {
    const mastra = new Mastra();
    const app = await createExpressApp(mastra, { tools: {}, mountPath: '/mastra' });

    const response = await request(app).get('/mastra/api');

    expect(response.status).toBe(200);
    expect(response.text).toContain('Mastra API');
  });
});

describe('startExpressServer', () => {
  it('starts an HTTP server backed by Mastra', async () => {
    const mastra = new Mastra();
    const server = await startExpressServer(mastra, { tools: {}, host: '127.0.0.1', port: 0 });
    activeServers.push(server);

    const address = server.address();
    expect(address).toBeTruthy();

    const port = typeof address === 'object' && address ? address.port : 0;
    expect(port).toBeGreaterThan(0);

    const response = await fetch(`http://127.0.0.1:${port}/api`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('Mastra API');
  });
});
