import { createServer } from 'node:net';
import { createOpenAI } from '@ai-sdk/openai';
import { LLMock } from '@copilotkit/aimock';
import { node } from '@elysiajs/node';
import { createDurableDisconnectTestSuite } from '@mastra/server-adapters-test-suite';
import { Elysia } from 'elysia';
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

// @elysiajs/node reports port 0 back instead of the bound port, so pick a free port up front.
async function getFreePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', () => resolve()));
  const address = probe.address();
  await new Promise(resolve => probe.close(resolve));
  return typeof address === 'object' && address ? address.port : 0;
}

type NodeResponse = { writableFinished: boolean; on(event: 'close', listener: () => void): unknown };
// `raw` is the srvx server behind @elysiajs/node; its `close(true)` also drops open connections.
type ElysiaNodeServer = { raw: { close(closeActiveConnections?: boolean): Promise<void> } };

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
    const port = await getFreePort();
    const server = await new Promise<ElysiaNodeServer>(resolve =>
      app.listen({ port, hostname: '127.0.0.1' }, started => resolve(started as unknown as ElysiaNodeServer)),
    );

    return {
      baseUrl: `http://127.0.0.1:${port}`,
      close: () => server.raw.close(true),
    };
  },
});
