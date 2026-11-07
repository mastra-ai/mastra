import type { Server } from 'node:http';
import { createOpenAI } from '@ai-sdk/openai';
import { LLMock } from '@copilotkit/aimock';
import { createDurableDisconnectTestSuite } from '@mastra/server-adapters-test-suite';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { afterAll, beforeAll } from 'vitest';
import { MastraServer } from '../index';

let llm: LLMock;
beforeAll(async () => {
  llm = new LLMock({ port: 0 });
  await llm.start();
});
afterAll(async () => {
  await llm.stop();
});

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
    const app = new Koa();
    app.use(async (ctx, next) => {
      ctx.res.on('close', () => {
        if (!ctx.res.writableFinished) onDisconnect(ctx.path);
      });
      await next();
    });
    app.use(bodyParser());
    await new MastraServer({ app, mastra, prefix: '/api' }).init();
    const server: Server = await new Promise(resolve => {
      const started = app.listen(0, '127.0.0.1', () => resolve(started));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
    return {
      baseUrl: `http://127.0.0.1:${address.port}`,
      close: async () => {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => {
          server.close(error => (error ? reject(error) : resolve()));
        });
      },
    };
  },
});
