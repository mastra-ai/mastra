import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: abort signal interacting with structured output.
 *
 * When an abort is triggered mid-loop (before the structured-output turn is
 * reached), the loop must halt cleanly: it must not make the structured-output
 * request, and the run must finish with an abort/tripwire reason rather than
 * resolving a complete, schema-valid object.
 *
 * These tests deterministically trigger the abort from inside a tool's execute
 * so the abort always lands between the tool turn and the structured-output
 * turn — no timing races. Each assertion is falsifiable: if abort handling is
 * removed, the loop reaches the structured turn and the assertions fail.
 */
describeForAllEngines(
  'AIMock loop scenario: abort during structured output',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('halts before the structured-output turn when abort fires mid-loop', async () => {
      const abortController = new AbortController();
      let toolExecuted = false;

      const gather = createTool({
        id: 'gather',
        description: 'Gather data, then abort before the structured turn.',
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
        execute: async () => {
          toolExecuted = true;
          abortController.abort();
          return { value: 'GATHERED' };
        },
      });

      const schema = z.object({
        items: z.array(z.string()),
        count: z.number(),
      });

      const { output, requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Gather data then produce the structured list.',
        tools: { gather },
        stopWhen: stepCountIs(10),
        abortSignal: abortController.signal,
        structuredOutput: { schema },
        fixtures: llm => {
          // Turn 1: call the tool (no tool result yet).
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_gather', name: 'gather', arguments: {} }] },
          );
          // Turn 2 (the structured-output turn): must NOT be reached after abort.
          llm.on(
            { endpoint: 'chat', hasToolResult: true },
            { content: JSON.stringify({ items: ['a', 'b'], count: 2 }) },
          );
        },
      });

      // The tool ran and triggered the abort.
      expect(toolExecuted).toBe(true);

      // The structured-output turn was never requested: only the first turn
      // (the tool call) reached the model. Without abort handling this would be 2.
      expect(requests).toHaveLength(1);

      // The run terminated due to the abort rather than completing normally.
      const finishReason = await output.finishReason;
      expect(finishReason).toMatch(/abort|cancelled|error|tripwire/i);

      // The structured object must NOT resolve to the complete, schema-valid
      // payload the (unreached) turn-2 fixture would have produced.
      let resolved: unknown;
      let threw = false;
      try {
        resolved = await (output as unknown as { object: Promise<unknown> }).object;
      } catch {
        threw = true;
      }
      if (!threw) {
        expect(resolved).not.toEqual({ items: ['a', 'b'], count: 2 });
      }
    });

    it('completes structured output when abort is never triggered', async () => {
      const abortController = new AbortController();

      const schema = z.object({
        result: z.string(),
        value: z.number(),
      });

      const { output, requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Return a simple result',
        abortSignal: abortController.signal,
        structuredOutput: { schema },
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: JSON.stringify({ result: 'success', value: 42 }) });
        },
      });

      // Not aborted: the object resolves and validates exactly.
      const object = await (output as unknown as { object: Promise<unknown> }).object;
      expect(schema.parse(object)).toEqual({ result: 'success', value: 42 });

      expect(requests.length).toBeGreaterThanOrEqual(1);

      const finishReason = await output.finishReason;
      expect(finishReason).not.toMatch(/abort|cancelled|tripwire/i);
    });

    it('does not produce a model request when the signal is already aborted', async () => {
      const abortController = new AbortController();
      abortController.abort(); // Aborted before the loop starts.

      const schema = z.object({ data: z.string() });

      const { output, requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Generate data',
        abortSignal: abortController.signal,
        structuredOutput: { schema },
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: JSON.stringify({ data: 'test' }) });
        },
      });

      // A pre-aborted signal prevents the loop from issuing the model request.
      expect(requests).toHaveLength(0);

      // And the structured object never resolves to the fixture payload.
      let resolved: unknown;
      let threw = false;
      try {
        resolved = await (output as unknown as { object: Promise<unknown> }).object;
      } catch {
        threw = true;
      }
      if (!threw) {
        expect(resolved).not.toEqual({ data: 'test' });
      }
    });
  },
  { skip: ['durable'] },
);
