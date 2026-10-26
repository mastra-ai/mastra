import { once } from 'node:events';
import { createServer, request } from 'node:http';
import { Agent } from '@mastra/core/agent';
import { AGENT_STREAM_TOPIC, createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { DurableDisconnectTestConfig } from './durable-disconnect-test-suite';

// The proxy imposes a byte-idle limit, not a total request duration limit.
export function createAgentHeartbeatTestSuite(config: DurableDisconnectTestConfig) {
  describe.each(['plain', 'durable', 'evented'] as const)('Agent SSE byte-idle proxy: %s (COR-1496)', kind => {
    for (const route of kind === 'plain' ? ['stream', 'stream/vnext'] : ['stream', 'observe']) {
      it.each([0, 40])(
        `${route}: heartbeat interval %i`,
        async interval => {
          const fixture = await config.setupModel();
          let entered!: () => void;
          const toolEntered = new Promise<void>(resolve => {
            entered = resolve;
          });
          const inner = new Agent({
            id: 'heartbeat-agent',
            name: 'Heartbeat agent',
            instructions: 'Call slow, then answer.',
            model: fixture.model,
            tools: {
              slow: createTool({
                id: 'slow',
                description: 'Wait without emitting events',
                inputSchema: z.object({}),
                execute: async () => {
                  entered();
                  await new Promise(resolve => setTimeout(resolve, 800));
                  return { done: true };
                },
              }),
            },
          });
          const agent =
            kind === 'durable'
              ? createDurableAgent({ agent: inner })
              : kind === 'evented'
                ? createEventedAgent({ agent: inner })
                : inner;
          const mastra = new Mastra({ agents: { agent }, logger: false, server: { agentSseHeartbeatMs: interval } });
          fixture.addResponse(0, { toolCalls: [{ id: 'slow-call', name: 'slow', arguments: {} }] });
          fixture.addResponse(1, { content: 'silent tool completed' });
          const server = await config.startServer(mastra, () => {});
          let idleDisconnects = 0;
          const proxy = createServer((req, res) => {
            const upstream = request(
              `${server.baseUrl}${req.url}`,
              { method: req.method, headers: req.headers },
              response => {
                res.writeHead(response.statusCode ?? 500, response.headers);
                let timer: ReturnType<typeof setTimeout>;
                const arm = () => {
                  clearTimeout(timer);
                  timer = setTimeout(() => {
                    idleDisconnects++;
                    res.destroy();
                    upstream.destroy();
                  }, 200);
                };
                arm();
                response.on('data', chunk => {
                  arm();
                  res.write(chunk);
                });
                response.on('end', () => {
                  clearTimeout(timer);
                  res.end();
                });
                response.on('close', () => clearTimeout(timer));
                res.on('close', () => {
                  clearTimeout(timer);
                  upstream.destroy();
                });
              },
            );
            upstream.on('error', () => res.destroy());
            req.pipe(upstream);
          });
          proxy.listen(0, '127.0.0.1');
          await once(proxy, 'listening');
          const address = proxy.address();
          if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
          const runId = crypto.randomUUID();
          try {
            if (route === 'observe') {
              const initial = await fetch(`${server.baseUrl}/api/agents/heartbeat-agent/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ runId, messages: 'Execute slow.' }),
                signal: AbortSignal.timeout(5_000),
              });
              await toolEntered;
              await initial.body!.cancel();
            }
            const baseUrl = route === 'stream/vnext' ? server.baseUrl : `http://127.0.0.1:${address.port}`;
            const response = await fetch(`${baseUrl}/api/agents/heartbeat-agent/${route}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(route === 'observe' ? { runId } : { runId, messages: 'Execute slow.' }),
              signal: AbortSignal.timeout(5_000),
            });
            expect(response.status).toBe(200);
            if (route !== 'stream/vnext') expect(response.headers.get('content-type')).toContain('text/event-stream');
            if (route === 'stream/vnext') {
              expect(response.headers.get('content-type')).not.toContain('text/event-stream');
              const text = await response.text();
              expect(text).not.toContain(': heartbeat');
              const events = text
                .split('\x1E')
                .filter(Boolean)
                .map(frame => JSON.parse(frame));
              expect(events.at(-1)).toMatchObject({ type: 'finish' });
              expect(text).toContain('silent tool completed');
            } else if (interval === 0) {
              await expect(response.text()).rejects.toThrow();
              expect(idleDisconnects).toBe(1);
            } else {
              const text = await response.text();
              expect(text).toContain(': heartbeat\n\n');
              expect(text).not.toContain('data: ": heartbeat');
              expect(text).toContain('silent tool completed');
              expect(text).toContain('"type":"finish"');
              expect(idleDisconnects).toBe(0);
              if ('pubsub' in agent && agent.pubsub) {
                const history = await agent.pubsub.getHistory(AGENT_STREAM_TOPIC(runId), 0);
                expect(history.length).toBeGreaterThan(0);
                expect(JSON.stringify(history)).not.toContain(': heartbeat');
                const offset = Math.floor(history.length / 2);
                const replay = await fetch(`${server.baseUrl}/api/agents/heartbeat-agent/observe`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ runId, offset }),
                  signal: AbortSignal.timeout(5_000),
                });
                const events = (await replay.text())
                  .split('\n\n')
                  .filter(frame => frame.startsWith('data: ') && frame !== 'data: [DONE]')
                  .map(frame => JSON.parse(frame.slice(6)));
                const expected = history.slice(offset).map(({ index: _index, ...event }) => event);
                expect(events).toEqual(JSON.parse(JSON.stringify(expected)));
              }
            }
          } finally {
            proxy.closeAllConnections();
            await new Promise<void>(resolve => proxy.close(() => resolve()));
            await server.close();
            await mastra.shutdown();
            await fixture.close();
          }
        },
        15_000,
      );
    }
  });
}
