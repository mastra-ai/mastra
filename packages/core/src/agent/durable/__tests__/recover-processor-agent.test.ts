/**
 * Processor hooks in a recovered run must receive the running Agent as `args.agent`.
 *
 * MockLanguageModelV2 instead of aimock: the restart harness loads core twice via
 * resetModules, like the other recovery tests here, and only the stream shape matters.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { consumeText, createGate, createRestartScenario } from './restart-harness';

type HookCall = { generation: number; hook: string; agent: unknown };

const HOOKS = ['processInputStep', 'processOutputStep', 'processToolResult'] as const;

function recordingProcessor(generation: number, calls: HookCall[]) {
  const processor: Record<string, unknown> = { id: 'recorder' };
  for (const hook of HOOKS) {
    processor[hook] = async (args: { agent?: unknown; messages?: unknown; result?: unknown }) => {
      calls.push({ generation, hook, agent: args.agent });
      return hook === 'processToolResult' ? args.result : hook === 'processOutputStep' ? args.messages : {};
    };
  }
  return processor;
}

describe('DurableAgent.recover() processor agent', () => {
  it.each(['durable', 'evented'] as const)('passes the recovered Agent to processor hooks on %s', async kind => {
    const gate = createGate();
    const calls: HookCall[] = [];
    const agents = new Map<number, unknown>();
    const scenario = createRestartScenario({
      kind,
      storageMode: 'serializing',
      runId: `recover-processor-agent-${kind}`,
      build: ({ core, generation }) => {
        const stamp = core.createTool({
          id: 'stamp',
          description: 'Stamp a marker',
          inputSchema: z.object({ marker: z.string() }),
          execute: async ({ marker }) => {
            if (generation === 1) await gate.wait();
            return { stamped: marker };
          },
        });
        const processor = recordingProcessor(generation, calls);
        const agent = new core.Agent({
          id: 'recorded',
          name: 'recorded',
          instructions: 'Stamp m1, then answer done.',
          tools: { stamp },
          inputProcessors: [processor as any],
          outputProcessors: [processor as any],
          model: new MockLanguageModelV2({
            doStream: async ({ prompt }) => {
              const stamped = prompt.some(
                message => Array.isArray(message.content) && message.content.some(part => part.type === 'tool-result'),
              );
              return {
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  ...(stamped
                    ? [
                        { type: 'text-start' as const, id: 'text' },
                        { type: 'text-delta' as const, id: 'text', delta: 'done' },
                        { type: 'text-end' as const, id: 'text' },
                      ]
                    : [
                        {
                          type: 'tool-call' as const,
                          toolName: 'stamp',
                          toolCallId: 'stamp-1',
                          input: '{"marker":"m1"}',
                        },
                      ]),
                  {
                    type: 'finish',
                    finishReason: stamped ? 'stop' : 'tool-calls',
                    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                  },
                ]),
              };
            },
          }),
        });
        agents.set(generation, agent);
        return agent;
      },
    });
    let originalText: Promise<string> | undefined;
    try {
      const original = await scenario.start(async ({ agent, runId }) => {
        originalText = consumeText(await agent.stream('stamp m1', { runId }));
        return originalText;
      });
      await gate.reached;
      const recovered = await scenario.restart(await original.checkpoint());
      expect(recovered.executionError).toBeUndefined();
      expect(recovered.text).toBe('done');

      const recoveredCalls = calls.filter(call => call.generation === 2);
      expect(new Set(recoveredCalls.map(call => call.hook))).toEqual(new Set(HOOKS));
      for (const call of recoveredCalls) expect(call.agent, call.hook).toBe(agents.get(2));
    } finally {
      gate.release();
      await originalText;
      await scenario.stop();
    }
  });
});
