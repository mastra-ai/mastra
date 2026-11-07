import { once } from 'node:events';
import { createServer, request as httpRequest } from 'node:http';
import type { ClientRequest, IncomingMessage, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * Configuration for the custom-route client-disconnect test suite
 */
export interface CustomRouteDisconnectTestSuiteConfig {
  /** Name for the test suite */
  suiteName?: string;

  /**
   * Build an app for the given Mastra instance, run the adapter's `init()`, and
   * serve it over real HTTP. Client disconnects must reach the adapter as they
   * do in production.
   */
  startServer: (mastra: Mastra) => Promise<{
    baseUrl: string;
    close: () => Promise<void>;
  }>;
}

interface FakeLLM {
  url: string;
  /** Resolves once the model request has started streaming. */
  streaming: Promise<void>;
  /** Resolves when the model request is closed before the response finished. */
  aborted: Promise<void>;
  close: () => Promise<void>;
}

/**
 * OpenAI-compatible chat completions server that streams text deltas until the
 * caller closes the connection, like a long model turn.
 */
async function startFakeLLM(): Promise<FakeLLM> {
  let resolveStreaming!: () => void;
  let resolveAborted!: () => void;
  const streaming = new Promise<void>(resolve => {
    resolveStreaming = resolve;
  });
  const aborted = new Promise<void>(resolve => {
    resolveAborted = resolve;
  });

  const server: Server = createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const timer = setInterval(() => {
        const chunk = {
          id: 'chatcmpl-1',
          object: 'chat.completion.chunk',
          created: 0,
          model: 'gpt-4o-mini',
          choices: [{ index: 0, delta: { content: 'tick ' }, finish_reason: null }],
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }, 25);
      res.on('close', () => {
        clearInterval(timer);
        if (!res.writableFinished) resolveAborted();
      });
      resolveStreaming();
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}/v1`,
    streaming,
    aborted,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
  };
}

/** Rejects with a named error if `promise` does not settle within `ms`. */
function withDeadline<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms waiting for ${what}`)), ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

let gcFn: (() => void) | undefined;

/**
 * Forces full garbage collections, the way a long-lived server process
 * eventually does while a response is streaming. Uses `--expose-gc` when the
 * process already has it, and otherwise enables it at runtime.
 */
async function collectGarbage() {
  if (!gcFn) {
    const exposed = (globalThis as { gc?: () => void }).gc;
    if (typeof exposed === 'function') {
      gcFn = exposed;
    } else {
      setFlagsFromString('--expose-gc');
      gcFn = runInNewContext('gc') as () => void;
    }
  }
  // WeakRef targets survive until the current job ends, so yield between
  // collections and give FinalizationRegistry callbacks a chance to run.
  for (let i = 0; i < 5; i++) {
    gcFn();
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

/**
 * A custom route that streams an agent run must stop that run, and its model
 * request, when the client disconnects. Adapters re-dispatch custom routes
 * through an inner `Request` whose signal follows the client connection.
 */
export function createCustomRouteDisconnectTestSuite(config: CustomRouteDisconnectTestSuiteConfig) {
  const { suiteName = 'Custom route client disconnect', startServer } = config;

  describe(suiteName, () => {
    const cleanups: (() => Promise<void>)[] = [];

    afterEach(async () => {
      for (const cleanup of cleanups.splice(0).reverse()) {
        await cleanup();
      }
    });

    // Technical: undici's `Request` forwards the outer abort signal to its own
    // signal through a listener that only weakly references the inner
    // controller. Once the route returns its streaming Response nothing else
    // holds the re-dispatched inner Request, so a GC drops it and the client
    // disconnect never reaches the run's `abortSignal`. (#29154)
    it('stops the agent run and its model request when the client disconnects mid-stream after a GC (#29154)', async () => {
      const llm = await startFakeLLM();
      cleanups.push(llm.close);

      const agent = new Agent({
        id: 'chat-agent',
        name: 'chat-agent',
        instructions: 'You are a test agent.',
        model: { id: 'openai/gpt-4o-mini', url: llm.url, apiKey: 'test-key' },
      });
      const mastra = new Mastra({
        logger: false,
        agents: { agent },
        server: {
          apiRoutes: [
            registerApiRoute('/chat', {
              method: 'POST',
              requiresAuth: false,
              handler: async c => {
                // Same wiring as `chatRoute` from @mastra/ai-sdk.
                const result = await c.get('mastra').getAgent('agent').stream('hi', { abortSignal: c.req.raw.signal });
                return new Response(result.textStream.pipeThrough(new TextEncoderStream()), {
                  headers: { 'content-type': 'text/plain; charset=utf-8' },
                });
              },
            }),
          ],
        },
      });
      const server = await startServer(mastra);
      cleanups.push(server.close);

      let clientRequest: ClientRequest | undefined;
      const firstChunk = new Promise<IncomingMessage>((resolve, reject) => {
        clientRequest = httpRequest(
          `${server.baseUrl}/chat`,
          { method: 'POST', headers: { 'content-type': 'application/json' } },
          res => {
            res.on('error', () => {});
            if (res.statusCode !== 200) {
              res.resume();
              reject(new Error(`Custom route responded with status ${res.statusCode}`));
              return;
            }
            res.once('data', () => resolve(res));
            res.once('end', () => reject(new Error('Custom route response ended before its first chunk')));
          },
        );
        clientRequest.on('error', reject);
        clientRequest.end(JSON.stringify({}));
      });
      cleanups.push(async () => {
        clientRequest?.destroy();
      });

      const response = await withDeadline(firstChunk, 5_000, 'the first response chunk');
      expect(response.statusCode).toBe(200);
      await withDeadline(llm.streaming, 5_000, 'the model request to start streaming');

      await collectGarbage();

      clientRequest!.on('error', () => {});
      clientRequest!.destroy();

      const outcome = await Promise.race([
        llm.aborted.then(() => 'model request aborted' as const),
        new Promise<'model request still running'>(resolve =>
          setTimeout(() => resolve('model request still running'), 3_000),
        ),
      ]);
      expect(outcome).toBe('model request aborted');
      // Setup, two 5s deadlines and the 3s abort race need more than the 5s default.
    }, 20_000);
  });
}
