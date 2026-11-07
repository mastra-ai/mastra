import type { Server } from 'node:http';
import { createOpenAI } from '@ai-sdk/openai';
import { LLMock } from '@copilotkit/aimock';
import { createDurableDisconnectTestSuite } from '@mastra/server-adapters-test-suite';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import { afterAll, beforeAll } from 'vitest';
import { MastraModule } from '../index';

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
    const moduleRef = await Test.createTestingModule({
      imports: [MastraModule.register({ mastra, prefix: '/api' })],
    }).compile();
    const app = moduleRef.createNestApplication({ logger: false });
    app.use((req: Request, res: Response, next: NextFunction) => {
      res.on('close', () => {
        if (!res.writableFinished) onDisconnect(req.path);
      });
      next();
    });
    await app.listen(0, '127.0.0.1');
    const server = app.getHttpServer() as Server;
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
    return {
      baseUrl: `http://127.0.0.1:${address.port}`,
      close: async () => {
        server.closeAllConnections();
        await app.close();
      },
    };
  },
});
