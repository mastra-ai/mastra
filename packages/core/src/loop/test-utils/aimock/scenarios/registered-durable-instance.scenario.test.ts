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
      try {
        const options = { runId: `payment-${method}`, maxSteps: 4, closeOnSuspend: true };
        const opening =
          method === 'stream'
            ? await (await raw.stream('Confirm payment', options)).getFullOutput()
            : await raw.generate('Confirm payment', options);
        expect(committed).toEqual([]);
        const workflows = await storage.getStore('workflows');
        const saved = await workflows?.getWorkflowRunById({
          workflowName: 'durable-agentic-loop',
          runId: opening.runId,
        });
        expect(saved?.snapshot).toMatchObject({ status: 'suspended' });
        expect(mastra.getAgent('anotherAlias')).toBe(mastra.getAgent('payments'));
        const resumed =
          method === 'stream'
            ? await (
                await raw.resumeStream({ code: '1234' }, { ...options, toolCallId: 'call_confirm' })
              ).getFullOutput()
            : await raw.resumeGenerate({ code: '1234' }, { ...options, toolCallId: 'call_confirm' });
        expect(resumed.text).toBe('Payment confirmed.');
        expect(committed).toEqual(['1234']);
        const finished = await workflows?.getWorkflowRunById({
          workflowName: 'durable-agentic-loop',
          runId: options.runId,
        });
        expect(finished?.snapshot).toMatchObject({ status: 'success' });
        expect(JSON.stringify(llm.getRequests().at(-1)?.body)).toContain('confirmed');
      } finally {
        await mastra.shutdown({ drainTimeout: 1000 });
      }
    },
    30_000,
  );
});
