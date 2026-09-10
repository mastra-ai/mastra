import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, onTestFinished } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { DurableAgent } from '../durable/durable-agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';

describe.each([false, true])('generate signal visibility (durable: %s)', durable => {
  beforeEach(() => agentThreadStreamRuntime.resetForTests());

  it.each([false, true])('leaves generated results unchanged (resumed: %s)', async resumed => {
    const results = [];
    for (const hideSignals of [undefined, ['reactive', 'system-reminder', 'state'] as const]) {
      let calls = 0;
      const prompts: unknown[] = [];
      const model = new MockLanguageModelV2({
        doGenerate: async ({ prompt }) => {
          prompts.push(prompt);
          const suspend = resumed && calls++ === 0;
          return {
            warnings: [],
            content: suspend
              ? [{ type: 'tool-call', toolCallId: 'approval', toolName: 'approval', input: '{}' }]
              : [{ type: 'text', text: 'generated answer' }],
            finishReason: suspend ? 'tool-calls' : 'stop',
            usage: { inputTokens: 1, outputTokens: 1 },
          };
        },
        doStream: async ({ prompt }) => {
          prompts.push(prompt);
          const suspend = resumed && calls++ === 0;
          return {
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              ...(suspend
                ? [{ type: 'tool-call', toolCallId: 'approval', toolName: 'approval', input: '{}' }]
                : [
                    { type: 'text-start', id: 'text' },
                    { type: 'text-delta', id: 'text', delta: 'generated answer' },
                    { type: 'text-end', id: 'text' },
                  ]),
              {
                type: 'finish',
                finishReason: suspend ? 'tool-calls' : 'stop',
                usage: { inputTokens: 1, outputTokens: 1 },
              },
            ]),
          };
        },
      });
      const agent = new Agent({
        id: `generate-visibility-${hideSignals ? 'hidden' : 'default'}`,
        name: 'Generate visibility',
        instructions: 'Test',
        durable,
        model,
        tools: {
          approval: createTool({
            id: 'approval',
            description: 'Request approval',
            inputSchema: z.object({}),
            suspendSchema: z.object({ question: z.string() }),
            resumeSchema: z.object({ approved: z.boolean() }),
            execute: async (_, context) => {
              if (!context?.agent?.resumeData) return context?.agent?.suspend({ question: 'Continue?' });
              return context.agent.resumeData;
            },
          }),
        },
        inputProcessors: [
          {
            id: 'generate-signals',
            processInputStep: async ({ sendSignal }) => {
              await sendSignal({ type: 'reactive', contents: 'retained generated reminder' });
              await sendSignal({ type: 'state', contents: 'retained generated state' });
            },
          },
        ],
      });
      const mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false });
      await mastra.startEventEngine();
      onTestFinished(() => mastra.stopEventEngine());
      const registered = mastra.getAgent('agent');
      expect(registered.constructor.name).toBe(durable ? 'DurableAgent' : 'Agent');
      const options = { hideSignals: hideSignals ? [...hideSignals] : undefined };
      const initial = await registered.generate('hello', options);
      let result = initial;
      if (resumed) {
        expect(initial.finishReason).toBe('suspended');
        result =
          registered instanceof DurableAgent
            ? await registered.resumeGenerate(initial.runId!, { approved: true }, options)
            : await registered.resumeGenerate(
                { approved: true },
                { ...options, runId: initial.runId, toolCallId: 'approval' },
              );
      }
      expect(result.text).toBe('generated answer');
      expect(result.finishReason).toBe('stop');
      expect(result.error).toBeUndefined();
      expect(JSON.stringify(prompts.at(-1))).toContain('retained generated reminder');
      expect(JSON.stringify(prompts.at(-1))).toContain('retained generated state');
      results.push({ text: result.text, content: result.content, usage: result.usage });
    }
    expect(results[1]).toEqual(results[0]);
  });
});
