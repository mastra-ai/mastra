import { createServer } from 'node:net';
import { LLMock } from '@copilotkit/aimock';
import { node } from '@elysiajs/node';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { Elysia } from 'elysia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MastraServer } from '../index';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// @elysiajs/node reports port 0 back instead of the bound port, so pick a free port up front.
async function getFreePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>(resolve => probe.listen(0, 'localhost', () => resolve()));
  const address = probe.address();
  await new Promise(resolve => probe.close(resolve));
  return typeof address === 'object' && address ? address.port : 0;
}

describe('Elysia stream client disconnect', () => {
  let llm: LLMock;
  let stopServer: () => unknown;
  let port: number;
  const loggedErrors: string[] = [];

  beforeEach(async () => {
    loggedErrors.length = 0;
    llm = new LLMock({ port: 0 });
    await llm.start();
    // ~40 small chunks spaced 50ms apart, so the client can disconnect mid-stream.
    llm.on(
      { userMessage: 'slow' },
      { content: 'one two three four five six seven eight nine ten '.repeat(4) },
      {
        latency: 50,
        chunkSize: 5,
      },
    );

    const agent = new Agent({
      id: 'streamer',
      name: 'streamer',
      instructions: 'Reply.',
      model: { id: 'openai/gpt-4o-mini', url: `${llm.url.replace(/\/+$/, '')}/v1`, apiKey: 'test-key' },
    });
    const mastra = new Mastra({ agents: { streamer: agent }, logger: false });
    const logger = mastra.getLogger();
    const originalError = logger.error.bind(logger);
    logger.error = (message: string, ...args: unknown[]) => {
      loggedErrors.push(message);
      originalError(message, ...args);
    };

    // Served through Elysia's official Node adapter, so disconnects reach the app the way they do in production.
    const app = new Elysia({ adapter: node() });
    await new MastraServer({ app, mastra }).init();
    port = await getFreePort();
    await new Promise<void>(resolve =>
      app.listen({ port, hostname: 'localhost' }, server => {
        stopServer = () => server.stop(true);
        resolve();
      }),
    );
  });

  afterEach(async () => {
    await stopServer();
    await llm.stop();
  });

  it.each(['/api/agents/streamer/stream', '/api/agents/streamer/stream/vnext'])(
    'closes %s quietly when the client disconnects mid-stream',
    async path => {
      const controller = new AbortController();
      const res = await fetch(`http://localhost:${port}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: 'slow' }),
        signal: controller.signal,
      });
      const reader = res.body!.getReader();
      for (let reads = 0; reads < 3; reads++) {
        const { done } = await reader.read();
        if (done) throw new Error('stream ended before the client disconnected');
      }
      controller.abort();

      await sleep(1000);

      expect(loggedErrors).toEqual([]);
    },
  );
});
