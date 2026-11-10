import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import type { DurableDisconnectTestConfig } from './durable-disconnect-test-suite';

export interface StructuredWakeTestConfig {
  setupModel: DurableDisconnectTestConfig['setupModel'];
  startServer: (mastra: Mastra) => Promise<{ baseUrl: string; close: () => Promise<void> }>;
}

const structuredOutput = {
  schema: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] },
  jsonPromptInjection: true,
};

// COR-1499: exercise the public JSON-schema payload through real HTTP, without a claimed owner.
export function createStructuredWakeTestSuite(config: StructuredWakeTestConfig) {
  describe.each(['plain', 'durable', 'evented'] as const)('HTTP structured idle wake: %s', kind => {
    it.each([
      { name: 'invalid plain text', content: 'This is plain text, not JSON.', valid: false },
      { name: 'valid JSON', content: '{"summary":"hello"}', valid: true },
    ])(
      'delivers $name result before the terminal boundary',
      async ({ content, valid }) => {
        const model = await config.setupModel();
        const storage = new InMemoryStore();
        const inner = new Agent({
          id: 'structured-wake-agent',
          name: 'Structured wake agent',
          instructions: 'Respond to the message.',
          model: model.model,
          memory: new MockMemory({ storage }),
          errorProcessors: [],
        });
        const agent =
          kind === 'durable'
            ? createDurableAgent({ agent: inner })
            : kind === 'evented'
              ? createEventedAgent({ agent: inner })
              : inner;
        const mastra = new Mastra({ agents: { agent }, storage, logger: false });
        let server: Awaited<ReturnType<StructuredWakeTestConfig['startServer']>> | undefined;
        let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
        const abort = new AbortController();
        const timeout = setTimeout(() => abort.abort(), 15_000);
        try {
          model.addResponse(0, { content });
          model.addResponse(1, { content });
          server = await config.startServer(mastra);
          const base = `${server.baseUrl}/api/agents/agent`;
          const post = (path: string, body: unknown) =>
            fetch(`${base}/${path}`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(body),
              signal: abort.signal,
            });
          const subscription = await post('threads/subscribe', { resourceId: 'r', threadId: 't' });
          expect(subscription.status).toBe(200);
          reader = subscription.body!.getReader();
          expect(agent.getActiveThreadRunId({ resourceId: 'r', threadId: 't' })).toBeUndefined();
          const send = await post('send-message', {
            resourceId: 'r',
            threadId: 't',
            message: 'hi',
            ifIdle: { streamOptions: { structuredOutput } },
          });
          expect(send.status).toBe(200);
          await send.json();
          // Stop exactly where a subscription consumer considers the run finished. Reading past
          // finish would hide the bug: durable validation used to arrive after that frame.
          const frames: { type: string; object?: unknown; payload?: unknown }[] = [];
          const decoder = new TextDecoder();
          let pending = '';
          let terminal = false;
          while (!terminal) {
            const { done, value } = await reader.read();
            if (done) break;
            pending += decoder.decode(value, { stream: true });
            let end: number;
            while (!terminal && (end = pending.indexOf('\n\n')) >= 0) {
              const block = pending.slice(0, end);
              pending = pending.slice(end + 2);
              for (const line of block.split('\n')) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6);
                if (data === '[DONE]') {
                  terminal = true;
                  break;
                }
                const frame = JSON.parse(data);
                frames.push(frame);
                if (['finish', 'error', 'abort'].includes(frame.type)) {
                  terminal = true;
                  break;
                }
              }
            }
          }
          const control = await post('stream-until-idle', {
            messages: 'hi',
            memory: { resource: 'r', thread: 'control' },
            structuredOutput,
          });
          expect(control.status).toBe(200);
          const controlText = await control.text();
          if (valid) {
            expect(frames).toContainEqual(
              expect.objectContaining({ type: 'object-result', object: { summary: 'hello' } }),
            );
            expect(frames.at(-1)?.type).toBe('finish');
            expect(controlText).toContain('object-result');
          } else {
            expect(controlText).toContain('STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED');
            expect(JSON.stringify(frames)).toContain('STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED');
            expect(frames.at(-1)?.type).toBe('error');
          }
          expect(model.getRequestCount()).toBe(2);
        } finally {
          clearTimeout(timeout);
          abort.abort();
          await reader?.cancel().catch(() => {});
          await mastra.shutdown();
          await server?.close();
          await model.close();
        }
      },
      30_000,
    );
  });
}
