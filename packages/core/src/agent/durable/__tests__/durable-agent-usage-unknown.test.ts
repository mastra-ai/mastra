/**
 * Ported from validation harness case T69 (usage-unknown).
 *
 * COR-1246 (GH #23469): token usage on durable runs was zero-seeded, so a
 * provider that reports no usage at all read back as `0` tokens instead of
 * "unknown". This case runs the same scripted two-call agent (`step` tool, then
 * the answer) against a provider that omits usage entirely and against one that
 * reports it, on plain, durable and evented engines. The `present` variant is
 * the control: two calls at `{inputTokens:1, outputTokens:1, totalTokens:2}`
 * must aggregate to 4 tokens.
 *
 * The harness records the finish payloads so the shape is visible; it does not
 * assert them there (#23341 / COR-1246). This port asserts every check the
 * harness asserts, per engine, and additionally reproduces the harness's
 * `done(contract)` deep-equality across engines — which is strictly stronger,
 * because the harness only ever compares cell verdicts.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../../memory/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import type { ModelScript, ModelTape, ParityEngine, ParitySnapshot, ParityStreamOptions } from './parity-harness';
import { expectEngineParity } from './parity-harness';

const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];

type Variant = 'omitted' | 'present';

/** The harness's `createScriptModel(..., {usage: true})` reported counts. */
const REPORTED = { inputTokens: 1, outputTokens: 1, totalTokens: 2 } as const;

/** Usage a variant's provider reports for one model call. */
function callUsage(variant: Variant): { inputTokens: number; outputTokens: number; totalTokens: number } | undefined {
  return variant === 'present' ? { ...REPORTED } : undefined;
}

/**
 * Tapes built here rather than reusing `textOnlyTape`/`toolCallTape`: those take
 * a defaulted usage, so passing `undefined` would silently restore `{10,20,30}`
 * instead of omitting usage like the harness's `usage:false` provider does.
 */
function textTape(text: string, usage: ReturnType<typeof callUsage>): ModelTape {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 't69-id', modelId: 't69-model', timestamp: new Date(0) },
    { type: 'text-start', id: 't69-text' },
    { type: 'text-delta', id: 't69-text', delta: text },
    { type: 'text-end', id: 't69-text' },
    { type: 'finish', finishReason: 'stop', ...(usage ? { usage } : {}) },
  ];
}

function toolTape(callId: string, usage: ReturnType<typeof callUsage>): ModelTape {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 't69-id-tool', modelId: 't69-model', timestamp: new Date(0) },
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

/**
 * The harness script: dispatch `step` while the prompt carries no tool result,
 * then answer `done`. `usage` is a pure function of the prompt, so a redelivered
 * call sees exactly what the first attempt saw.
 */
function script(variant: Variant): ModelScript {
  const usage = callUsage(variant);
  return {
    respond: (request, callIndex) => {
      const results = request.prompt.reduce((total, message) => {
        if (message.role !== 'tool' || !Array.isArray(message.content)) return total;
        return total + message.content.filter(part => part.type === 'tool-result').length;
      }, 0);
      const id = `t69-call-${callIndex + 1}`;
      return results === 0 ? toolTape(id, usage) : textTape('done', usage);
    },
  };
}

/** The harness's `step` fixture: idempotent per `n`, logged so commits can be counted. */
function createStepTool(log: number[]) {
  return createTool({
    id: 'step',
    description: 'Take a step.',
    inputSchema: z.object({ n: z.number() }),
    execute: async ({ n }) => {
      if (!log.includes(n)) log.push(n);
      return { done: n };
    },
  });
}

/** The harness's `toolLog` commit list. */
function commits(log: number[]): number[] {
  return [...log].sort((a, b) => a - b);
}

function usageOf(turn: ParitySnapshot) {
  return turn.fullOutput.usage as Record<string, unknown> | undefined;
}

describe('durable agent usage that the provider never reported', () => {
  for (const variant of ['omitted', 'present'] as const) {
    it(`${variant}: every harness check holds on every engine`, async () => {
      const logs = new Map<ParityEngine, number[]>();
      const results = await expectEngineParity({
        engines: ENGINES,
        model: script(variant),
        buildAgent: ({ engine, model }) => {
          const log: number[] = [];
          const agent = new Agent({
            id: `t69-${variant}`,
            name: `t69-${variant}`,
            instructions: 'Follow the script.',
            model,
            tools: { step: createStepTool(log) },
            memory: new MockMemory(),
          });
          logs.set(engine, log);
          return agent as unknown as Agent<string, any, any>;
        },
        input: 'Go.',
        options: { runId: `t69-run-${variant}`, maxSteps: 4 } as ParityStreamOptions,
      });

      const observed: Record<string, unknown> = {};
      for (const engine of ENGINES) {
        const result = results[engine];
        expect(result, `${engine} results`).toBeDefined();
        const turn = result!.turns[0]!;
        const usage = usageOf(turn) ?? null;
        const counts = usage ? [usage.inputTokens, usage.outputTokens, usage.totalTokens] : [];
        const zeros = counts.filter(count => count === 0);
        const log = logs.get(engine) ?? [];
        // The harness's own per-cell checks, asserted on this engine's run.
        expect(turn.text, `${engine}: the scripted answer is in the run`).toBe('done');
        if (variant === 'omitted') {
          // Reporting 0 claims a measurement that was never taken (COR-1246 / #23469).
          expect(zeros, `${engine}: no token count is reported as 0 when the provider reported none`).toHaveLength(0);
          // Pinned literally: none of the three counts is a measurement the
          // provider actually took.
          for (const key of ['inputTokens', 'outputTokens', 'totalTokens'] as const) {
            expect(typeof usage?.[key], `${engine}: ${key} is unknown, not a number`).not.toBe('number');
          }
        } else {
          expect(usage?.totalTokens, `${engine}: two model calls report 4 tokens in total`).toBe(4);
          expect(usage?.inputTokens, `${engine}: inputTokens`).toBe(2);
          expect(usage?.outputTokens, `${engine}: outputTokens`).toBe(2);
        }
        observed[engine] = {
          variant,
          usage,
          usageKeys: Object.keys(usage ?? {}).sort(),
          text: turn.text,
          commits: commits(log),
        };
      }
      // The harness's `pair(plain, other)` contract deep-equality.
      expect(observed.durable, 'durable contract').toEqual(observed.plain);
      expect(observed.evented, 'evented contract').toEqual(observed.plain);
    });
  }
});
