import { randomUUID } from 'crypto';
import { createServer, connect } from 'net';
import type { AddressInfo, Server, Socket } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { serve } from '@hono/node-server';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { MastraClient } from '@mastra/client-js';
import { Hono } from 'hono';
import getPort from 'get-port';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

export interface ThreadStreamTestConfig {
  testNameSuffix?: string;
}

const usage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };

// A reply the test holds midway: its first word streams at once, the rest once the test lets it.
function createHeldReplyModel() {
  let release = () => {};
  const model = new MockLanguageModelV2({
    doStream: async () => {
      const released = new Promise<void>(resolve => (release = resolve));
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: new ReadableStream({
          async start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            });
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'Half' });
            await released;
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: ', then whole.' });
            controller.enqueue({ type: 'text-end', id: 'text-1' });
            controller.enqueue({ type: 'finish', finishReason: 'stop', usage });
            controller.close();
          },
        }),
      };
    },
  });
  return { model, finishReply: () => release() };
}

// The network between the page and the server: the test cuts it, as a phone locking does, and opens it again.
async function createCuttableNetwork(serverPort: number) {
  const sockets = new Set<Socket>();
  let open = true;
  const proxy: Server = createServer(page => {
    if (!open) return void page.destroy();
    const server = connect(serverPort, '127.0.0.1');
    for (const socket of [page, server]) {
      sockets.add(socket);
      socket.on('error', () => {});
      socket.on('close', () => {
        sockets.delete(socket);
        page.destroy();
        server.destroy();
      });
    }
    page.pipe(server).pipe(page);
  });
  await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
  const { port } = proxy.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    cut: () => {
      open = false;
      for (const socket of sockets) socket.destroy();
    },
    reopen: () => {
      open = true;
    },
    close: () => new Promise<void>(resolve => proxy.close(() => resolve())),
  };
}

type Chunk = { type: string; runId?: string; payload?: any };

const textOf = (message: { content?: { parts?: Array<{ type: string; text?: string }> } }) =>
  (message.content?.parts ?? []).flatMap(part => (part.type === 'text' && part.text ? [part.text] : [])).join('');

/**
 * A page following a thread loses its stream mid-reply (a phone locked, the network gone) and follows the thread
 * again with the stored history. Run against a real Mastra server with memory: what the history and the parts sent
 * after it hold must make the reply whole, once.
 */
export function createThreadStreamTests(config: ThreadStreamTestConfig = {}) {
  const suffix = config.testNameSuffix ? ` (${config.testNameSuffix})` : '';

  describe(`thread stream followed again after it broke${suffix}`, () => {
    let serverPort: number;
    let server: ReturnType<typeof serve>;
    let held: ReturnType<typeof createHeldReplyModel>;
    let network: Awaited<ReturnType<typeof createCuttableNetwork>>;

    beforeAll(async () => {
      const [{ Mastra }, { Agent }, { LibSQLStore }, { MastraServer }, { Memory }] = await Promise.all([
        import('@mastra/core/mastra'),
        import('@mastra/core/agent'),
        import('@mastra/libsql'),
        import('@mastra/hono'),
        import('@mastra/memory'),
      ]);
      held = createHeldReplyModel();
      const storage = new LibSQLStore({
        id: 'thread-stream-e2e',
        url: `file:${join(tmpdir(), `mastra-${randomUUID()}.db`)}`,
      });
      const agent = new Agent({
        id: 'assistant',
        name: 'assistant',
        instructions: 'You answer.',
        model: held.model,
        memory: new Memory({ storage }),
      });
      const mastra = new Mastra({ agents: { assistant: agent }, storage });
      const app = new Hono();
      const mastraServer = new MastraServer({ app, mastra });
      mastraServer.registerContextMiddleware();
      await mastraServer.registerRoutes();
      serverPort = await getPort();
      server = serve({ fetch: app.fetch, port: serverPort });
    });

    afterAll(async () => {
      held.finishReply();
      await new Promise<void>(resolve => server.close(() => resolve()));
    });

    afterEach(async () => {
      held.finishReply();
      await network?.close();
    });

    // Follows a new thread through the network the test can cut, and sends it a message from straight to the server.
    async function followAndAsk() {
      network = await createCuttableNetwork(serverPort);
      const threadId = randomUUID();
      const ids = { resourceId: 'user-1', threadId };
      const chunks: Chunk[] = [];
      const subscription = await new MastraClient({ baseUrl: network.baseUrl, retries: 0 })
        .getAgent('assistant')
        .subscribeToThread({ ...ids, withRunStatus: true });
      const following = subscription.processDataStream({
        onChunk: chunk => void chunks.push(chunk as Chunk),
        reconnect: { delayMs: 50, withInitialHistory: true },
      });
      const direct = new MastraClient({ baseUrl: `http://127.0.0.1:${serverPort}`, retries: 0 });
      await direct.getAgent('assistant').sendMessage({ message: 'Tell me more', ...ids });
      await expect
        .poll(() => chunks.some(c => c.type === 'text-delta' && c.payload?.text === 'Half'), { timeout: 15_000 })
        .toBe(true);
      const storedMessages = async () =>
        (await direct.getMemoryThread({ threadId, agentId: 'assistant' }).listMessages()).messages;
      return { chunks, subscription, following, storedMessages };
    }

    // What the page can rebuild of the reply from the catch-up: its stored copy, then the text parts sent after it.
    const replyAfterCatchUp = (chunks: Chunk[]) => {
      const historyAt = chunks.map(c => c.type).lastIndexOf('thread-history');
      const history = chunks[historyAt]!.payload as { messages: any[]; activeRunId: string | null };
      const stored = history.messages
        .filter(m => m.role === 'assistant')
        .map(textOf)
        .join('');
      const sentAfter = chunks
        .slice(historyAt + 1)
        .flatMap(c => (c.type === 'text-delta' ? [c.payload.text as string] : []))
        .join('');
      return { history, text: stored + sentAfter };
    };

    it(`catches up on a reply that finished while the stream was down, from the history alone${suffix}`, async () => {
      const { chunks, subscription, following, storedMessages } = await followAndAsk();

      network.cut();
      held.finishReply();
      await expect
        .poll(async () => (await storedMessages()).map(textOf), { timeout: 15_000 })
        .toContain('Half, then whole.');
      network.reopen();
      await expect.poll(() => chunks.filter(c => c.type === 'thread-history').length, { timeout: 15_000 }).toBe(1);
      await new Promise(resolve => setTimeout(resolve, 300));

      const { history, text } = replyAfterCatchUp(chunks);
      expect(history.activeRunId).toBeNull();
      expect(text).toBe('Half, then whole.');
      subscription.unsubscribe();
      await following.catch(() => {});
    });

    it(`goes on with a reply still running when the stream comes back, writing it once${suffix}`, async () => {
      const { chunks, subscription, following } = await followAndAsk();

      network.cut();
      network.reopen();
      await expect.poll(() => chunks.filter(c => c.type === 'thread-history').length, { timeout: 15_000 }).toBe(1);
      const { history } = replyAfterCatchUp(chunks);
      expect(history.activeRunId).toEqual(expect.any(String));
      held.finishReply();
      await expect
        .poll(() => chunks.some(c => c.type === 'thread-run-status' && c.runId === history.activeRunId), {
          timeout: 15_000,
        })
        .toBe(true);

      expect(replyAfterCatchUp(chunks).text).toBe('Half, then whole.');
      subscription.unsubscribe();
      await following.catch(() => {});
    });
  });
}
