import type { Server } from 'node:http';
import { createOpenAI } from '@ai-sdk/openai';
import { LLMock } from '@copilotkit/aimock';
import { MastraClient } from '@mastra/client-js';
import type { ChunkType } from '@mastra/core/stream';
import { createDurableDisconnectTestSuite } from '@mastra/server-adapters-test-suite';
import express from 'express';
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

async function collect(response: {
  processDataStream: (options: { onChunk: (chunk: ChunkType<unknown>) => void }) => Promise<void>;
}) {
  const frames: ChunkType<unknown>[] = [];
  await response.processDataStream({
    onChunk: chunk => {
      frames.push(chunk);
    },
  });
  return frames;
}

createDurableDisconnectTestSuite({
  skipUntilIdleDisconnectReplay: true,
  observeWithClient: async (baseUrl, runId, offset) =>
    collect(await new MastraClient({ baseUrl, retries: 0 }).getAgent('agent').observe({ runId, offset })),
  streamWithClient: async (baseUrl, { messages, runId }) =>
    collect(await new MastraClient({ baseUrl, retries: 0 }).getAgent('agent').stream(messages, { runId })),
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
    const app = express();
    app.use((req, res, next) => {
      res.on('close', () => {
        if (!res.writableFinished) onDisconnect(req.path);
      });
      next();
    });
    app.use(express.json());
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
