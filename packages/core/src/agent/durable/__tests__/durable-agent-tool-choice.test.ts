/**
 * Ported from validation harness case T24 (tool-choice).
 *
 * `toolChoice` is a per-call option, so every engine must forward it to the
 * model request unchanged and then drive the loop off it the same way: `none`
 * lets the model answer with no tool turn, `required` and a named tool force
 * one tool turn followed by a text answer. The harness checks the captured
 * request bodies (`scriptRequests`), so the requested `toolChoice` is asserted
 * on the recorded requests, not inferred from the output, and the tool-run
 * count is asserted on both sides of the loop (requests and committed tools).
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import type { CapturedRequest, ModelScript, ParityEngine, ParitySnapshot } from './parity-harness';
import { chunksOfType, expectEngineParity, textOnlyTape, toolCallTape } from './parity-harness';

const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];

type Variant = 'required' | 'none' | 'named';

/**
 * The harness's `want` map: what the model request must actually carry. A
 * string `'required'` on the call option is normalized to `{ type: 'required' }`
 * by the time it reaches the model.
 */
const WANT_TOOL_CHOICE: Record<Variant, unknown> = {
  required: { type: 'required' },
  none: { type: 'none' },
  named: { type: 'tool', toolName: 'step' },
};

/** The `toolChoice` the harness passes to `ctx.stream(...)`. */
const CALL_TOOL_CHOICE: Record<Variant, 'auto' | 'none' | 'required' | { type: 'tool'; toolName: string }> = {
  required: 'required',
  none: 'none',
  named: { type: 'tool', toolName: 'step' },
};

/** How many tool turns the scripted model performs before answering. */
const TOOL_TURNS: Record<Variant, number> = { required: 1, none: 0, named: 1 };

/** Counts the tool results a request's prompt already carries, like the harness script. */
function toolResultCount(request: CapturedRequest): number {
  let count = 0;
  for (const message of request.prompt) {
    if (message.role !== 'tool' || !Array.isArray(message.content)) continue;
    count += message.content.filter(part => part.type === 'tool-result').length;
  }
  return count;
}

/** Runs one T24 variant; returns each engine's results and its committed step tools. */
async function runT24(variant: Variant) {
  const commits = new Map<ParityEngine, number>();

  const model: ModelScript = {
    respond: request => {
      const done = toolResultCount(request);
      return done < TOOL_TURNS[variant]
        ? toolCallTape('step', { n: done + 1 }, `call-${done + 1}`)
        : textOnlyTape(TOOL_TURNS[variant] === 0 ? 'no tools used' : `finished ${done} steps`);
    },
  };

  const results = await expectEngineParity({
    model,
    buildAgent: ({ engine, model: agentModel }) => {
      let committed = 0;
      commits.set(engine, 0);
      const step = createTool({
        id: 'step',
        description: 'Advance one step.',
        inputSchema: z.object({ n: z.number() }),
        execute: async ({ n }) => {
          committed += 1;
          commits.set(engine, committed);
          return { done: n };
        },
      });
      return new Agent({
        id: 't24-agent',
        name: 't24',
        instructions: 'Follow the script.',
        model: agentModel,
        tools: { step },
      });
    },
    run: async handle => {
      await handle.turn('Go.', {
        maxSteps: 4,
        memory: { thread: `t24-thread-${variant}`, resource: 't24-resource' },
        toolChoice: CALL_TOOL_CHOICE[variant],
      });
    },
  });

  return { results, commits };
}

/** The harness's shared check: the run settled with exactly one finish and no throw. */
function expectSettledWithOneFinish(turn: ParitySnapshot | undefined) {
  expect(chunksOfType(turn!, 'finish')).toBe(1);
  expect(turn!.finishReason).toBe('stop');
}

describe('T24 tool choice (plain, durable, evented)', () => {
  it.each<Variant>(['required', 'none', 'named'])('%s: forwards toolChoice and drives the loop', async variant => {
    const { results, commits } = await runT24(variant);

    for (const engine of ENGINES) {
      const turn = results[engine]!.turns.at(-1);
      const requests = results[engine]!.requests;

      expectSettledWithOneFinish(turn);

      // 'first request carried the requested toolChoice'
      expect(requests[0]!.toolChoice).toEqual(WANT_TOOL_CHOICE[variant]);

      if (variant === 'none') {
        // 'no tool ran'
        expect(commits.get(engine)).toBe(0);
        expect(requests).toHaveLength(1);
      } else {
        // 'one tool turn then an answer'
        expect(commits.get(engine)).toBe(1);
        expect(requests).toHaveLength(2);
      }
    }
  });
});
