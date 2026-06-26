/**
 * Agent ↔ DurableAgent Parity Tests
 *
 * For each scenario, we run the same input through a plain `Agent` and a
 * `DurableAgent` (wrapping the same Agent config), then assert that the
 * observable stream output matches.
 *
 * See `parity-harness.ts` for the comparison shape and what we deliberately
 * exclude from the check (runId, timestamps, span ids, response.id, etc.).
 *
 * This file is the **gating test** for the bridge-durable-agent workstream:
 * every subsequent fix should either
 *   (a) make a previously-failing scenario here pass, or
 *   (b) add a new scenario that fails until the fix lands.
 */
import { describe, it } from 'vitest';
import { z } from 'zod';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createMockModelFactory, expectAgentParity, textOnlyTape } from './parity-harness';

describe('Agent ↔ DurableAgent parity', () => {
  describe('basic text streaming', () => {
    it('produces identical text, usage, and finishReason', async () => {
      const modelFactory = createMockModelFactory({
        tapes: [textOnlyTape('Hello from the parity harness.')],
      });

      await expectAgentParity({
        buildAgent: () =>
          new Agent({
            id: 'parity-basic-text',
            name: 'Parity Basic Text',
            instructions: 'Respond with a single sentence.',
            model: modelFactory(),
          }),
        streamAgent: a => a.stream('Say hello'),
        streamDurable: a => a.stream('Say hello'),
      });
    });

    // TODO(parity): DurableAgent stops after the tool-call step with
    // `finishReason: 'tool-calls'` and `stepCount: 1`, while Agent continues
    // to a second LLM step and produces `text: 'Echoed: hi'`. The tool-call
    // chunk fields (`toolCallId`, `toolName`, `args`) also round-trip as
    // `undefined` through the durable serialization layer. Tracked under the
    // broader serialization/loop-continuation gap — flip this back on once
    // tool-call round-tripping is verified.
    it.todo('preserves multi-step accumulated usage across tool→text');
  });

  describe('activeTools filtering', () => {
    it('forwards activeTools identically to the LLM request on both sides', async () => {
      const modelFactory = createMockModelFactory({
        tapes: [textOnlyTape('Done')],
      });

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

      await expectAgentParity({
        buildAgent: () =>
          new Agent({
            id: 'parity-active-tools',
            name: 'Parity Active Tools',
            instructions: 'Use only enabled tools',
            model: modelFactory(),
            tools: { allowedTool, hiddenTool },
          }),
        streamAgent: a => a.stream('use the allowed tool', { activeTools: ['allowedTool'] }),
        streamDurable: a => a.stream('use the allowed tool', { activeTools: ['allowedTool'] }),
      });
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
    it.todo('preserves toolsets across resume (gates toolsets_clienttools_resume)');
    it.todo('preserves clientTools across resume (gates toolsets_clienttools_resume)');
  });

  describe('non-stream APIs', () => {
    it.todo('generate() produces identical final result (gates durable_generate)');
    it.todo('resumeGenerate() produces identical final result (gates durable_generate)');
  });

  describe('abort', () => {
    it.todo('abortSignal cancels durably across resume (gates abort_signal_durable)');
  });

  describe('resume', () => {
    it.todo('resume(..., { untilIdle }) drains background tasks (gates resume_until_idle)');
  });
});
