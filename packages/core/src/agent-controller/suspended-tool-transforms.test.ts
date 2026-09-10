import { Memory } from '@mastra/memory';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../agent';
import { createDurableAgent } from '../agent/durable';
import { globalRunRegistry } from '../agent/durable/run-registry';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage';
import { createTool } from '../tools';

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

it.each(
  [false, true].flatMap(durable => ['manual', 'restart', 'automatic', 'repeat'].map(mode => ({ durable, mode }))),
)(
  'preserves transformed input across $mode resume (durable=$durable)',
  async ({ durable, mode }) => {
    const storage = new InMemoryStore({ id: `transforms-${durable}-${mode}` });
    const memory = new Memory({ storage });
    const received: any[] = [];
    const prompts: unknown[] = [];
    let transformations = 0;
    let originalRunId = '';
    const model = new MockLanguageModelV3({
      provider: 'openai',
      modelId: 'gpt-4o',
      doStream: async options => {
        prompts.push(options.prompt);
        const isAuto = mode === 'automatic' && prompts.length === 2;
        const call = prompts.length === 1 || isAuto;
        return {
          stream: simulateReadableStream({
            chunks: call
              ? [
                  {
                    type: 'tool-call' as const,
                    toolCallType: 'function' as const,
                    toolCallId: isAuto ? 'resume-1' : 'transform-1',
                    toolName: 'transform',
                    input: JSON.stringify({
                      value: isAuto ? 'model-changed-value' : 'original',
                      ...(isAuto ? { resumeData: false, suspendedToolRunId: originalRunId } : {}),
                    }),
                    providerExecuted: false,
                  },
                  {
                    type: 'finish' as const,
                    finishReason: { unified: 'tool-calls' as const, raw: 'tool-calls' },
                    usage,
                  },
                ]
              : [
                  { type: 'text-start' as const, id: 'done' },
                  { type: 'text-delta' as const, id: 'done', delta: 'Done.' },
                  { type: 'text-end' as const, id: 'done' },
                  { type: 'finish' as const, finishReason: { unified: 'stop' as const, raw: 'stop' }, usage },
                ],
          }),
        };
      },
    });
    const build = () => {
      const base = new Agent({
        id: 'transform-agent',
        name: 'Transform proof',
        instructions: 'Use the tool.',
        model,
        memory,
        defaultOptions: { maxSteps: 3, autoResumeSuspendedTools: true },
        tools: {
          transform: createTool({
            id: 'transform',
            description: 'Transform once.',
            inputSchema: z.object({
              value: z.string().transform(value => ({
                value,
                counter: ++transformations,
                at: new Date('2026-01-01'),
                map: new Map([['key', 1]]),
              })),
            }),
            suspendSchema: z.object({ question: z.string() }),
            resumeSchema: z.boolean(),
            execute: async (input, context) => {
              received.push(structuredClone(input));
              if (context?.agent?.resumeData !== undefined && (mode !== 'repeat' || received.length === 3))
                return { done: true };
              input.value.value = 'mutated by tool';
              return context?.agent?.suspend({ question: 'Continue?' });
            },
          }),
        },
      });
      const agent = durable ? (createDurableAgent({ agent: base }) as unknown as Agent) : base;
      const mastra = new Mastra({ storage, agents: { transform: agent }, logger: false });
      return { agent, mastra };
    };
    let runtime = build();
    const opts = { memory: { thread: `thread-${durable}-${mode}`, resource: 'transform-user' } };
    const first = await runtime.agent.stream('Use the tool.', opts);
    originalRunId = first.runId;
    for await (const chunk of first.fullStream) {
      if (chunk.type === 'tool-call-suspended') break;
    }
    const workflows = (await storage.getStore('workflows'))!;
    await vi.waitFor(async () =>
      expect(
        (
          await workflows.loadWorkflowSnapshot({
            workflowName: durable ? 'durable-agentic-loop' : 'agentic-loop',
            runId: first.runId,
          })
        )?.status,
      ).toBe('suspended'),
    );
    expect(received).toHaveLength(1);
    if (mode === 'restart') {
      await runtime.mastra.stopEventEngine();
      globalRunRegistry.delete(first.runId);
      runtime = build();
    }
    const resumed =
      mode === 'automatic'
        ? await runtime.agent.stream('No, continue with the original value.', opts)
        : await runtime.agent.resumeStream(false, { runId: first.runId, toolCallId: 'transform-1' });
    const chunks = [];
    for await (const chunk of resumed.fullStream) {
      chunks.push(chunk);
      if (mode === 'repeat' && chunk.type === 'tool-call-suspended') break;
    }
    expect(chunks.filter(chunk => chunk.type === 'error' || chunk.type === 'tool-error')).toEqual([]);
    expect(received).toHaveLength(2);
    expect(received[1]).toEqual(received[0]);
    if (mode === 'repeat') {
      const again = await runtime.agent.resumeStream(true, { runId: first.runId, toolCallId: 'transform-1' });
      for await (const _chunk of again.fullStream) {
        /* drain native completion */
      }
      expect(received).toHaveLength(3);
      expect(received[2]).toEqual(received[0]);
    }
    expect(transformations).toBe(1);
    expect(JSON.stringify(prompts)).not.toContain('__mastraToolInput');
    expect(JSON.stringify(prompts)).not.toContain('"counter":');
    await runtime.mastra.stopEventEngine();
  },
  20_000,
);
