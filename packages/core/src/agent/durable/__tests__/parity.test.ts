/**
 * Agent ↔ DurableAgent ↔ EventedAgent Parity Tests
 *
 * For each scenario, we run the same input through a plain `Agent`, a
 * `createDurableAgent` wrapper and a `createEventedAgent` wrapper (each
 * around the same Agent config), then assert that the observable stream
 * output and the model requests match.
 *
 * See `parity-harness.ts` for the comparison shape and what we deliberately
 * exclude from the check (runId, timestamps, span ids, response.id, etc.).
 *
 * This file is the **gating test** for the bridge-durable-agent workstream:
 * every subsequent fix should either
 *   (a) make a previously-failing scenario here pass, or
 *   (b) add a new scenario that fails until the fix lands.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { expectEngineParity, PARITY_ENGINES, textOnlyTape, toolCallTape } from './parity-harness';

describe('Agent ↔ DurableAgent ↔ EventedAgent parity', () => {
  describe('basic text streaming', () => {
    it('produces identical text, usage, and finishReason', async () => {
      await expectEngineParity({
        model: { tapes: [textOnlyTape('Hello from the parity harness.')] },
        buildAgent: ({ model }) =>
          new Agent({
            id: 'parity-basic-text',
            name: 'Parity Basic Text',
            instructions: 'Respond with a single sentence.',
            model,
          }),
        input: 'Say hello',
      });
    });

    it('preserves multi-step accumulated usage across tool→text', async () => {
      const echo = createTool({
        id: 'echo',
        description: 'Echo the input',
        inputSchema: z.object({ value: z.string() }),
        execute: async ({ value }) => `echo:${value}`,
      });

      const results = await expectEngineParity({
        model: { tapes: [toolCallTape('echo', { value: 'hi' }), textOnlyTape('Echoed: hi')] },
        buildAgent: ({ model }) =>
          new Agent({ id: 'parity-tool-text', name: 'Tool Text', instructions: 'Use echo', model, tools: { echo } }),
        input: 'echo hi',
        options: { maxSteps: 2 },
      });

      for (const engine of PARITY_ENGINES) {
        const turn = results[engine]!.turns.at(-1)!;
        expect(turn.stepCount).toBe(2);
        expect(turn.finishReason).toBe('stop');
        expect(turn.text).toBe('Echoed: hi');
        // Tool step (15/10/25) plus text step (10/20/30). `raw` mirrors the last
        // step's provider usage rather than being summed; it is identical on
        // every engine and would differ here if the workflow dropped it.
        expect(turn.usage).toEqual({
          inputTokens: 25,
          outputTokens: 30,
          totalTokens: 55,
          raw: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        });
      }
    });
  });

  describe('activeTools filtering', () => {
    it('forwards activeTools identically to the LLM request on every engine', async () => {
      const allowedTool = createTool({
        id: 'allowedTool',
        description: 'Allowed',
        inputSchema: z.object({}),
        execute: async () => 'allowed',
      });
      const hiddenTool = createTool({
        id: 'hiddenTool',
        description: 'Hidden',
        inputSchema: z.object({}),
        execute: async () => 'hidden',
      });

      const results = await expectEngineParity({
        model: { tapes: [textOnlyTape('Done')] },
        buildAgent: ({ model }) =>
          new Agent({
            id: 'parity-active-tools',
            name: 'Parity Active Tools',
            instructions: 'Use only enabled tools',
            model,
            tools: { allowedTool, hiddenTool },
          }),
        input: 'use the allowed tool',
        options: { activeTools: ['allowedTool'] },
      });

      // Requests already match plain; pin plain to the filtered tool list.
      expect(results.plain!.requests[0]!.tools?.map(t => t.name)).toEqual(['allowedTool']);
    });
  });

  // -------------------------------------------------------------------------
  // The following blocks are written but intentionally `it.todo` — they are
  // the failing-test placeholders for the rest of the workstream. Each one
  // should be flipped to `it(...)` as the corresponding task lands.
  // -------------------------------------------------------------------------

  describe('options that must round-trip through serialization', () => {
    it.todo('honours stopWhen identically (gates serialize_stopwhen)');
    it.todo('honours full modelSettings identically (gates serialize_model_settings)');
    it.todo('honours per-call instructions / system identically (gates serialize_misc_options)');
    it.todo('honours disableBackgroundTasks identically (gates serialize_misc_options)');
  });

  describe('callbacks', () => {
    it.todo('fires onAbort symmetrically (gates callback_bridge)');
    it.todo('fires onIterationComplete symmetrically (gates callback_bridge)');
  });

  describe('tool approval', () => {
    it.todo('honours function-form requireToolApproval (gates require_tool_approval_fn)');
  });

  describe('per-call tool injection', () => {
    // Per-call `toolsets` / `clientTools` are stored on the in-process run
    // registry at prepare time and read back from there during resume. The
    // contract is verified end-to-end in `resume-api.test.ts` under the
    // 'per-call tool injection survives in-process resume' describe block.
    // A true cross-process resume falls back to the agent's static tools
    // because per-call tools carry closures and cannot be JSON-serialized.
    it.todo('preserves toolsets across resume (cross-process; gated on a future serialization story)');
    it.todo('preserves clientTools across resume (cross-process; gated on a future serialization story)');
  });

  describe('non-stream APIs', () => {
    it.todo('generate() produces identical final result (gates durable_generate)');
    it.todo('resumeGenerate() produces identical final result (gates durable_generate)');
  });

  describe('abort', () => {
    // Runtime abort coverage (mid-stream `result.abort()` and pre-aborted
    // external `abortSignal`) lives in `durable-agent-abort.test.ts`. A true
    // resume-after-abort parity check requires the resume_until_idle slice
    // to land first; keeping the todo as a tracking marker.
    it.todo('abortSignal cancels durably across resume (gates resume_until_idle)');
  });

  describe('resume', () => {
    it.todo('resume(..., { untilIdle }) drains background tasks (gates resume_until_idle)');
  });
});
