import { createOpenAI } from '@ai-sdk/openai-v5';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { Mastra } from '../../../../mastra';
import { InMemoryStore } from '../../../../storage/mock';
import { createTool } from '../../../../tools';
import { useLoopScenarioAimock } from '../aimock-scenario';

describe('The original durable Agent stays durable after registration (#28189)', () => {
  const getMock = useLoopScenarioAimock();

  it.each(['stream', 'generate'] as const)(
    '%s persists and resumes the durable loop through registration aliases',
    async method => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', hasToolResult: false },
        {
          toolCalls: [{ id: 'call_confirm', name: 'confirm', arguments: {} }],
        },
      );
      llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Payment confirmed.' });
      const committed: string[] = [];
      const openai = createOpenAI({ apiKey: 'test', baseURL: `${llm.url}/v1` });
      const raw = new Agent({
        id: 'payment-agent',
        name: 'Payments',
        instructions: 'Confirm the payment.',
        model: openai('gpt-4o-mini'),
        durable: true,
        tools: {
          confirm: createTool({
            id: 'confirm',
            description: 'Confirm payment.',
            inputSchema: z.object({}),
            suspendSchema: z.object({}),
            resumeSchema: z.object({ code: z.string() }),
            execute: async (_input, context) => {
              if (!context?.agent?.resumeData) return context?.agent?.suspend?.({});
              committed.push(context.agent.resumeData.code);
              return { confirmed: true };
            },
          }),
        },
      });
      const storage = new InMemoryStore();
      const mastra = new Mastra({ agents: { payments: raw }, storage, logger: false });
      mastra.addAgent(raw, 'anotherAlias');
      let finishOriginalStream: (() => Promise<void>) | undefined;
      let releaseReader: (() => void) | undefined;
      try {
        const options = { runId: `payment-${method}`, maxSteps: 4 };
        if (method === 'stream') {
          const opening = await raw.stream('Confirm payment', options);
          const types: string[] = [];
          const reader = opening.fullStream.getReader();
          releaseReader = () => reader.releaseLock();
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            types.push(value.type);
            if (value.type === 'tool-call-suspended') break;
          }
          expect(types).toContain('tool-call-suspended');
          // The original stream must stay open across suspension by default.
          finishOriginalStream = async () => {
            const remaining: string[] = [];
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              remaining.push(value.type);
            }
            expect(remaining).toContain('finish');
          };
        } else {
          await raw.generate('Confirm payment', options);
        }
        expect(committed).toEqual([]);
        const workflows = await storage.getStore('workflows');
        await expect
          .poll(async () => {
            const saved = await workflows?.getWorkflowRunById({
              workflowName: 'durable-agentic-loop',
              runId: options.runId,
            });
            return saved?.snapshot;
          })
          .toMatchObject({ status: 'suspended' });
        expect(mastra.getAgent('anotherAlias')).toBe(mastra.getAgent('payments'));
        const resumed =
          method === 'stream'
            ? await (
                await raw.resumeStream({ code: '1234' }, { ...options, toolCallId: 'call_confirm' })
              ).getFullOutput()
            : await raw.resumeGenerate({ code: '1234' }, { ...options, toolCallId: 'call_confirm' });
        expect(resumed.text).toBe('Payment confirmed.');
        expect(committed).toEqual(['1234']);
        await finishOriginalStream?.();
        await expect
          .poll(async () => {
            const finished = await workflows?.getWorkflowRunById({
              workflowName: 'durable-agentic-loop',
              runId: options.runId,
            });
            return finished?.snapshot;
          })
          .toBeUndefined();
        expect(JSON.stringify(llm.getRequests().at(-1)?.body)).toContain('confirmed');
      } finally {
        releaseReader?.();
        await mastra.shutdown({ drainTimeout: 1000 });
      }
    },
    30_000,
  );
});
