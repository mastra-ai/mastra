/**
 * Ported from validation harness case T83 (usage-partial-omission).
 *
 * COR-1246 (GH #23469): usage uncertainty is per counter and survives
 * aggregation. A missing provider count is not zero, while an explicit zero is
 * a known measurement. T69 covers the all-present and all-omitted endpoints;
 * this case covers selective omission between two calls, on plain, durable and
 * evented engines.
 *
 * The harness records the finish payloads; this port asserts every harness
 * check per engine and additionally reproduces the harness's `done(contract)`
 * deep-equality across engines.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../../memory/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import type { CapturedRequest, ModelScript, ModelTape, ParityEngine, ParityStreamOptions } from './parity-harness';
import { expectEngineParity } from './parity-harness';

const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];

type Variant = 'known-then-omitted' | 'partial-omitted' | 'explicit-zero' | 'all-present';

const KNOWN = { inputTokens: 1, outputTokens: 1, totalTokens: 2 } as const;
const ZERO = { inputTokens: 0, outputTokens: 0, totalTokens: 0 } as const;

type Usage = Record<string, number>;

/** The harness's `usageFor(variant, call)`. */
function usageFor(variant: Variant, call: number): Usage | undefined {
  if (call === 0) return { ...KNOWN };
  if (variant === 'known-then-omitted') return undefined;
  if (variant === 'partial-omitted') return { inputTokens: 1 };
  if (variant === 'explicit-zero') return { ...ZERO };
  return { ...KNOWN };
}

function textTape(text: string, usage: Usage | undefined): ModelTape {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 't83-id', modelId: 't83-model', timestamp: new Date(0) },
    { type: 'text-start', id: 't83-text' },
    { type: 'text-delta', id: 't83-text', delta: text },
    { type: 'text-end', id: 't83-text' },
    { type: 'finish', finishReason: 'stop', ...(usage ? { usage } : {}) },
  ];
}

function toolTape(callId: string, usage: Usage | undefined): ModelTape {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 't83-id-tool', modelId: 't83-model', timestamp: new Date(0) },
    {
      type: 'tool-call',
      toolCallId: callId,
      toolName: 'step',
      input: JSON.stringify({ n: 1 }),
      providerExecuted: false,
    },
    { type: 'finish', finishReason: 'tool-calls', ...(usage ? { usage } : {}) },
  ];
}

/** Tool results already in the prompt, like the harness's `toolResults(p)`. */
function toolResultCount(request: CapturedRequest): number {
  let count = 0;
  for (const message of request.prompt) {
    if (message.role !== 'tool' || !Array.isArray(message.content)) continue;
    count += message.content.filter(part => part.type === 'tool-result').length;
  }
  return count;
}

/** The harness script, with usage driven by the prompt's tool results. */
function script(variant: Variant): ModelScript {
  return {
    respond: (request, callIndex) => {
      const call = toolResultCount(request);
      const usage = usageFor(variant, call);
      return call === 0 ? toolTape(`t83-call-${callIndex + 1}`, usage) : textTape('done', usage);
    },
  };
}

function createStepTool(): ReturnType<typeof createTool> {
  return createTool({
    id: 'step',
    description: 'Take a step.',
    inputSchema: z.object({ n: z.number() }),
    execute: async ({ n }) => ({ done: n }),
  });
}

describe('durable agent usage with selectively omitted counters', () => {
  for (const variant of ['known-then-omitted', 'partial-omitted', 'explicit-zero', 'all-present'] as const) {
    it(`${variant}: every harness check holds on every engine`, async () => {
      const results = await expectEngineParity({
        engines: ENGINES,
        model: script(variant),
        buildAgent: ({ model }) =>
          new Agent({
            id: `t83-${variant}`,
            name: `t83-${variant}`,
            instructions: 'Follow the script.',
            model,
            tools: { step: createStepTool() },
            memory: new MockMemory(),
          }) as unknown as Agent<string, any, any>,
        input: 'Go.',
        options: { runId: `t83-run-${variant}`, maxSteps: 4 } as ParityStreamOptions,
      });

      const observed: Record<string, unknown> = {};
      for (const engine of ENGINES) {
        const result = results[engine];
        expect(result, `${engine} results`).toBeDefined();
        const turn = result!.turns[0]!;
        const usage = (turn.fullOutput.usage ?? null) as Usage | null;
        const terminalUsage = (turn.finishChunk.usage ?? null) as Usage | null;
        expect(turn.text, `${engine}: the scripted answer is in the run`).toBe('done');

        const unknown = (key: string) => typeof usage?.[key] !== 'number';
        if (variant === 'known-then-omitted') {
          for (const key of ['inputTokens', 'outputTokens', 'totalTokens'] as const) {
            expect(
              usage?.[key] !== KNOWN[key] && unknown(key),
              `${engine}: ${key} stays unknown when the second call omits it`,
            ).toBe(true);
          }
        } else if (variant === 'partial-omitted') {
          expect(usage?.inputTokens, `${engine}: inputTokens sums the two reported values`).toBe(2);
          expect(unknown('outputTokens'), `${engine}: outputTokens stays unknown when the second call omits it`).toBe(
            true,
          );
          expect(unknown('totalTokens'), `${engine}: totalTokens stays unknown when the second call omits it`).toBe(
            true,
          );
        } else if (variant === 'explicit-zero') {
          expect(
            usage?.inputTokens === 1 && usage?.outputTokens === 1 && usage?.totalTokens === 2,
            `${engine}: explicit zero remains known and contributes zero to each aggregate`,
          ).toBe(true);
        } else {
          expect(
            usage?.inputTokens === 2 && usage?.outputTokens === 2 && usage?.totalTokens === 4,
            `${engine}: all-present usage sums both calls`,
          ).toBe(true);
        }

        expect(terminalUsage, `${engine}: terminal finish usage equals the resolved full output usage`).toEqual(usage);

        observed[engine] = {
          variant,
          usage,
          usageKeys: Object.keys(usage ?? {}).sort(),
          text: turn.text,
          finishPayloads: [{ usage: terminalUsage }],
        };
      }
      // The harness's `pair(plain, other)` contract deep-equality.
      expect(observed.durable, 'durable contract').toEqual(observed.plain);
      expect(observed.evented, 'evented contract').toEqual(observed.plain);
    });
  }
});
