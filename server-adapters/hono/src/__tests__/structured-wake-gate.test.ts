import { once } from 'node:events';
import { createOpenAI } from '@ai-sdk/openai';
import { LLMock } from '@copilotkit/aimock';
import { serve } from '@hono/node-server';
import { createStructuredWakeTestSuite } from '@mastra/server-adapters-test-suite';
import { Hono } from 'hono';
import { afterAll, beforeAll } from 'vitest';
import { MastraServer } from '../index';

let llm: LLMock;
beforeAll(async () => {
  llm = new LLMock({ port: 0 });
  await llm.start();
});
afterAll(async () => llm.stop());

createStructuredWakeTestSuite({
  setupModel: async () => ({
    model: createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1` })('gpt-4o-mini'),
    addResponse: (sequenceIndex, response) => llm.on({ endpoint: 'chat', sequenceIndex }, response),
    getRequestCount: () => llm.getRequests().length,
    close: async () => {
      llm.clearFixtures();
      llm.clearRequests();
      llm.resetMatchCounts();
    },
  }),
  startServer: async mastra => {
    const app = new Hono();
    await new MastraServer({ app, mastra, prefix: '/api' }).init();
    const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 });
    if (!server.listening) await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
    return {
      baseUrl: `http://127.0.0.1:${address.port}`,
      close: async () => {
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
      },
    };
  },
});
