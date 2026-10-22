import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { Elysia } from 'elysia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MastraServer } from '../index';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Serves an Elysia app over real HTTP and cancels the response body when the client goes away,
 * as Bun and other fetch-based servers do. The shared test helper never cancels, so it can't
 * exercise disconnects.
 */
async function serveWithDisconnect(app: Elysia): Promise<{ server: Server; port: number }> {
  const server = createServer(async (req, res) => {
    const controller = new AbortController();
    res.on('close', () => controller.abort());
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const response = await app.fetch(
      new Request(`http://localhost${req.url}`, {
        method: req.method,
        headers: { 'content-type': req.headers['content-type'] ?? 'application/json' },
        body: chunks.length ? Buffer.concat(chunks) : undefined,
        signal: controller.signal,
      }),
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    const reader = response.body!.getReader();
    res.on('close', () => void reader.cancel().catch(() => {}));
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } catch {
      // body cancelled after disconnect
    }
    res.end();
  });
  await new Promise<void>(resolve => server.listen(0, 'localhost', () => resolve()));
  const address = server.address();
  return { server, port: typeof address === 'object' && address ? address.port : 0 };
}

describe('Elysia stream client disconnect', () => {
  let llm: LLMock;
  let server: Server;
  let port: number;
  const loggedErrors: string[] = [];

  beforeEach(async () => {
    loggedErrors.length = 0;
    llm = new LLMock({ port: 0 });
    await llm.start();
    // ~40 small chunks spaced 50ms apart, so the client can disconnect mid-stream.
    llm.on({ userMessage: 'slow' }, { content: 'one two three four five six seven eight nine ten '.repeat(4) }, {
      latency: 50,
      chunkSize: 5,
    });

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

    const app = new Elysia();
    await new MastraServer({ app, mastra }).init();
    ({ server, port } = await serveWithDisconnect(app));
  });

  afterEach(async () => {
    await new Promise(resolve => server.close(resolve));
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
