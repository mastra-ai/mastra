import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: tool lifecycle hooks (onInputAvailable, onOutput).
 *
 * Per-tool lifecycle hooks let users intercept execution: `onInputAvailable`
 * fires once the parsed input is available (before `execute` runs), and
 * `onOutput` fires after `execute` resolves (before the tool result is fed back
 * to the model). A refactor to tool-call-step that stops wiring these hooks
 * through would silently break observability / side-effect use cases. These
 * scenarios pin the invocation contract.
 */
describeForAllEngines(
  'AIMock loop scenario: tool lifecycle hooks',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('invokes onInputAvailable before execute and onOutput after execute', async () => {
      const events: string[] = [];

      const tracedTool = createTool({
        id: 'traced_tool',
        description: 'A tool with lifecycle hooks.',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({ answer: z.string() }),
        onInputAvailable: vi.fn(async ({ input }) => {
          events.push(`input:${(input as { query: string }).query}`);
        }),
        onOutput: vi.fn(async ({ output, toolName }) => {
          events.push(`output:${toolName}:${(output as { answer: string }).answer}`);
        }),
        execute: async ({ query }) => {
          events.push(`execute:${query}`);
          return { answer: `replied to ${query}` };
        },
      });

      const { output, requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Answer the question.',
        tools: { traced_tool: tracedTool },
        stopWhen: stepCountIs(5),
        fixtures: llm => {
          // Turn 1: call the traced tool.
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_traced', name: 'traced_tool', arguments: { query: 'hello' } }] },
          );
          // Turn 2: wrap up after tool result.
          llm.on(
            { endpoint: 'chat', toolCallId: 'call_traced', hasToolResult: true },
            { content: 'The tool replied: replied to hello' },
          );
        },
      });

      // The run completed with the final text.
      const text = await output.text;
      expect(text).toContain('replied to hello');

      // Two turns: tool call, then final text.
      expect(requests).toHaveLength(2);

      // Both hooks fired and in the expected order: input -> execute -> output.
      expect(events).toEqual(['input:hello', 'execute:hello', 'output:traced_tool:replied to hello']);
    });

    it('still runs execute and surfaces a result if onInputAvailable throws', async () => {
      const events: string[] = [];

      const flakyHookTool = createTool({
        id: 'flaky_hook_tool',
        description: 'A tool whose onInputAvailable throws.',
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.boolean() }),
        onInputAvailable: vi.fn(async () => {
          events.push('onInputAvailable:throw');
          throw new Error('HOOK_BOOM');
        }),
        onOutput: vi.fn(async () => {
          events.push('onOutput:called');
        }),
        execute: async () => {
          events.push('execute:ran');
          return { ok: true };
        },
      });

      const { output, requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Call the tool.',
        tools: { flaky_hook_tool: flakyHookTool },
        stopWhen: stepCountIs(5),
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_fh', name: 'flaky_hook_tool', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Tool finished.' });
        },
      });

      // The hook threw but execute still ran and the loop finished.
      expect(requests).toHaveLength(2);
      expect(events).toContain('onInputAvailable:throw');
      expect(events).toContain('execute:ran');
      expect(events).toContain('onOutput:called');

      const text = await output.text;
      expect(text).toContain('finished');
    });
  },
  { skip: ['durable'] },
);
