import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, onTestFinished } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';

describe.each([false, true])('resume signals (durable: %s)', durable => {
  describe.each(['resumeStream', 'resumeStreamUntilIdle'] as const)('%s signal exclusions', method => {
    beforeEach(() => agentThreadStreamRuntime.resetForTests());

    it.each([false, true])('filters resumed output without filtering model context (excluded: %s)', async excluded => {
      let calls = 0;
      const prompts: unknown[] = [];
      const model = new MockLanguageModelV2({
        doStream: async ({ prompt }) => {
          prompts.push(prompt);
          const first = calls++ === 0;
          return {
            rawCall: { rawPrompt: prompt, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              ...(first
                ? [{ type: 'tool-call', toolCallId: 'approval', toolName: 'approval', input: '{}' }]
                : [
                    { type: 'text-start', id: 'text' },
                    { type: 'text-delta', id: 'text', delta: 'resumed answer' },
                    { type: 'text-end', id: 'text' },
                  ]),
              {
                type: 'finish',
                finishReason: first ? 'tool-calls' : 'stop',
                usage: { inputTokens: 1, outputTokens: 1 },
              },
            ]),
          };
        },
      });
      const agent = new Agent({
        id: 'resume-exclusions',
        name: 'resume-exclusions',
        instructions: 'test',
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
            id: 'resume-reminder',
            processInputStep: async ({ sendSignal }) => {
              await sendSignal({ type: 'reactive', contents: 'retained resume reminder' });
            },
          },
        ],
      });
      const mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false });
      await mastra.startEventEngine();
      onTestFinished(() => mastra.stopEventEngine());
      const registered = mastra.getAgent('agent');
      expect(registered.constructor.name).toBe(durable ? 'DurableAgent' : 'Agent');
      const initial = await registered.stream('hello');
      const initialParts = [];
      for await (const part of initial.fullStream) {
        initialParts.push(part);
        // Durable output remains open across suspension until the run is resumed.
        if (part.type === 'tool-call-suspended') break;
      }
      expect(initialParts.some(part => part.type === 'tool-call-suspended')).toBe(true);

      const resumed = await registered[method](
        { approved: true },
        {
          runId: initial.runId,
          toolCallId: 'approval',
          excludeSignals: excluded ? ['system-reminder'] : [],
        },
      );
      const parts = [];
      for await (const part of resumed.fullStream) parts.push(part);
      expect(parts.filter(part => part.type === 'data-signal')).toHaveLength(excluded ? 0 : 1);
      expect(parts.filter(part => part.type === 'text-delta').map(part => part.payload.text)).toEqual([
        'resumed answer',
      ]);
      expect(parts.some(part => part.type === 'finish')).toBe(true);
      expect(calls).toBe(2);
      expect(JSON.stringify(prompts[1])).toContain('retained resume reminder');
    });
  });
});
