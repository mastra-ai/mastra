/**
 * A value a tool writes into its request context reaches the processors of the run's next step on
 * the durable engine, with or without a suspension in between, exactly as it does on the run's
 * first step. The engine's own request-context plumbing must not put a copy between the two.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Observability } from './default';
import { TestExporter } from './exporters';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

describe('a tool write reaches the next step on the durable engine', () => {
  const cells = [
    { name: 'without a suspension', approval: false, resumeContext: 'none' },
    { name: 'after a warm resume that reuses the run context', approval: true, resumeContext: 'none' },
    { name: 'after a warm resume with a fresh caller context', approval: true, resumeContext: 'fresh' },
  ] as const;
  for (const cell of cells) {
    it(
      cell.name,
      async () => {
        let calls = 0;
        const model = new MockLanguageModelV2({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              ...(++calls === 1
                ? [{ type: 'tool-call', toolCallId: 'call-1', toolName: 'writer', input: '{}' }]
                : [
                    { type: 'text-start', id: 't' },
                    { type: 'text-delta', id: 't', delta: 'done' },
                    { type: 'text-end', id: 't' },
                  ]),
              { type: 'finish', finishReason: calls === 1 ? 'tool-calls' : 'stop', usage },
            ] as any[]),
          }),
        });
        const seen: unknown[] = [];
        const agent = new Agent({
          id: 'writer-agent',
          name: 'writer',
          instructions: 'Use the tool, then answer.',
          model,
          inputProcessors: [
            {
              id: 'read-from-tool',
              processInputStep: async ({ requestContext, messageList }: any) => {
                seen.push(requestContext?.get('fromTool') ?? null);
                return messageList;
              },
            } as any,
          ],
          tools: {
            writer: createTool({
              id: 'writer',
              description: 'Writes a value into the request context',
              inputSchema: z.object({}),
              requireApproval: cell.approval,
              execute: async (_input, context) => {
                context!.requestContext!.set('fromTool', 'written');
                return { ok: true };
              },
            }),
          },
        });
        const runner = createDurableAgent({ agent });
        const exporter = new TestExporter({ validateLifecycle: false, logMetricsOnFlush: false });
        const mastra = new Mastra({
          agents: { runner },
          storage: new InMemoryStore(),
          logger: false,
          observability: new Observability({ configs: { test: { serviceName: 'writes', exporters: [exporter] } } }),
        });
        try {
          // A caller value makes the run's context non-empty, as every real caller's is.
          const first = await runner.generate('go', {
            maxSteps: 5,
            requestContext: new RequestContext([['tenant', 'acme']]),
          });
          if (cell.approval) {
            expect(first.finishReason).toBe('suspended');
            const resumed = await runner.resumeGenerate(
              first.runId,
              { approved: true },
              {
                toolCallId: 'call-1',
                maxSteps: 5,
                ...(cell.resumeContext === 'fresh' ? { requestContext: new RequestContext([['tenant', 'acme']]) } : {}),
              },
            );
            expect(resumed.finishReason).toBe('stop');
          } else {
            expect(first.finishReason).toBe('stop');
          }
          expect(seen, 'the step after the tool call reads what the tool wrote').toEqual([null, 'written']);
        } finally {
          await mastra.shutdown();
        }
      },
      30_000,
    );
  }
});
