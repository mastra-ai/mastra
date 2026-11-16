import { createOpenAI } from '@ai-sdk/openai';
import { LLMock } from '@copilotkit/aimock';
import { node } from '@elysiajs/node';
import { createDurableDisconnectTestSuite } from '@mastra/server-adapters-test-suite';
import { Elysia } from 'elysia';
import { afterAll, beforeAll } from 'vitest';
import { MastraServer } from '../index';
import { listenWithNodeAdapter } from './helpers';

let llm: LLMock;
beforeAll(async () => {
  llm = new LLMock({ port: 0 });
  await llm.start();
});
afterAll(async () => {
  await llm.stop();
});

type NodeResponse = { writableFinished: boolean; on(event: 'close', listener: () => void): unknown };

createDurableDisconnectTestSuite({
  setupModel: async () => ({
    model: createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1` })('gpt-4o-mini'),
    addResponse: (sequenceIndex, response) => {
      llm.on({ endpoint: 'chat', sequenceIndex }, response);
    },
    getRequestCount: () => llm.getRequests().length,
    close: async () => {
      llm.clearFixtures();
      llm.clearRequests();
      llm.resetMatchCounts();
    },
  }),
  startServer: async (mastra, onDisconnect) => {
    // Served through Elysia's official Node adapter, the way the other adapters' suites run over a real socket.
    const app = new Elysia({ adapter: node() });
    app.onRequest(({ request }) => {
      const res = (request as { runtime?: { node?: { res?: NodeResponse } } }).runtime?.node?.res;
      res?.on('close', () => {
        if (!res.writableFinished) {
          onDisconnect(new URL(request.url).pathname);
        }
      });
    });
    await new MastraServer({ app, mastra, prefix: '/api' }).init();
    return listenWithNodeAdapter(app);
  },
});
