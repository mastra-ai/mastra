/** Ported from validation harness case T76 (ui-om-route). */
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { createOpenAI } from '@ai-sdk/openai-v7';
import { createUIMessageStreamResponse } from '@internal/ai-v6';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, expect, it } from 'vitest';
import { toAISdkStream } from '../convert-streams';

describe.each(['plain', 'durable'] as const)('OM route on %s (COR-1409)', engine => {
  for (const variant of ['status', 'buffering'] as const) {
    it(`${variant}: background consumption preserves SSE progress and durable answers`, async () => {
      let observerCalls = 0;
      const server = createServer(async (request, response) => {
        let raw = '';
        for await (const chunk of request) raw += chunk;
        const body = JSON.parse(raw) as { model: string; messages: { role: string; content: unknown }[] };
        const observer = body.model === 'observer';
        if (observer) observerCalls++;
        const text = observer
          ? '<observations>## October 22, 2026\n- User requested two answers.</observations><current-task>Answer the current turn.</current-task>'
          : JSON.stringify(body.messages.filter(message => message.role === 'user').at(-1)).includes('second turn')
            ? 'second answer'
            : 'first answer';
        response.writeHead(200, { 'Content-Type': 'text/event-stream' });
        response.write(
          `data: ${JSON.stringify({
            id: randomUUID(),
            object: 'chat.completion.chunk',
            created: 1,
            model: body.model,
            choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
          })}\n\n`,
        );
        response.write(
          `data: ${JSON.stringify({
            id: randomUUID(),
            object: 'chat.completion.chunk',
            created: 1,
            model: body.model,
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
            usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 },
          })}\n\n`,
        );
        response.end('data: [DONE]\n\n');
      });
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Missing HTTP server address');
      const provider = createOpenAI({ apiKey: 'test-key', baseURL: `http://127.0.0.1:${address.port}/v1` });
      const storage = new LibSQLStore({ id: randomUUID(), url: ':memory:' });
      const memory = new Memory({
        storage,
        options: {
          lastMessages: 100,
          semanticRecall: false,
          generateTitle: false,
          observationalMemory: {
            enabled: true,
            observation: {
              model: provider.chat('observer'),
              ...(variant === 'buffering' ? { messageTokens: 20, bufferTokens: false } : {}),
            },
            reflection: { model: provider.chat('observer'), observationTokens: 50_000 },
          },
        },
      });
      const plain = new Agent({
        id: randomUUID(),
        name: 'OM route',
        instructions: 'Answer the current turn.',
        model: provider.chat('gpt-4o'),
        memory,
      });
      const agent = engine === 'durable' ? createDurableAgent({ agent: plain }) : plain;
      const mastra = new Mastra({ agents: { agent }, storage, logger: false });
      const thread = randomUUID();
      const resource = randomUUID();
      const allParts: { type: string; delta?: string; transient?: boolean }[] = [];
      const backgroundErrors: unknown[] = [];
      try {
        for (const turn of ['first', 'second']) {
          const run = await agent.stream(`${turn} turn. ${'The user needs a useful answer. '.repeat(20)}`, {
            memory: { thread, resource },
          });
          const output = 'output' in run ? run.output : run;
          const consumption = output.consumeStream().catch(error => {
            backgroundErrors.push(error);
          });
          void consumption;
          const response = createUIMessageStreamResponse({
            stream: toAISdkStream(output, { from: 'agent', version: 'v6' }),
          });
          const sse = await response.text();
          const parts = sse
            .split('\n')
            .filter(line => line.startsWith('data: ') && line !== 'data: [DONE]')
            .map(line => JSON.parse(line.slice(6)) as { type: string; delta?: string; transient?: boolean });
          await consumption;
          expect(
            parts
              .filter(part => part.type === 'text-delta')
              .map(part => part.delta)
              .join(''),
          ).toBe(`${turn} answer`);
          expect(parts.at(-1)?.type).toBe('finish');
          expect(parts.some(part => part.type === 'error')).toBe(false);
          const finish = parts.findIndex(part => part.type === 'finish');
          expect(parts.slice(finish + 1).some(part => part.type.startsWith('data-om-'))).toBe(false);
          allParts.push(...parts);
          if ('cleanup' in run) run.cleanup();
        }
        expect(backgroundErrors).toEqual([]);
        expect(allParts.some(part => part.type === 'data-om-status')).toBe(true);
        if (variant === 'buffering') {
          expect(observerCalls).toBeGreaterThan(0);
          expect(allParts.some(part => /^data-om-(buffering-|observation-|thread-update)/.test(part.type))).toBe(true);
        } else expect(observerCalls).toBe(0);
        const { messages } = await memory.recall({ threadId: thread, resourceId: resource });
        const persisted = messages.flatMap(message => message.content.parts ?? []);
        expect(persisted.some(part => part.type === 'text' && part.text.includes('second answer'))).toBe(true);
        expect(persisted.some(part => part.type === 'data-om-status')).toBe(false);
        expect(persisted.some(part => 'transient' in part && part.transient === true)).toBe(false);
      } finally {
        await mastra.shutdown();
        await storage.close();
        await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
      }
    }, 30_000);
  }
});
