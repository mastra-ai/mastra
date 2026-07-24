import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: tool execution error handling.
 *
 * When a tool throws, the loop must surface the failure back to the model as a
 * tool result (rather than crashing the run) so the model can recover on the
 * next turn. These scenarios pin that recovery contract.
 */
// DurableAgent terminates the loop on non-ToolNotFoundError tool errors
// instead of feeding them back to the model for recovery.
describeForAllEngines('AIMock loop scenario: tool execution errors', engine => {
  const getMock = useLoopScenarioAimock();

  it('feeds a thrown tool error back to the model and lets it recover', async () => {
    const flakyTool = createTool({
      id: 'flaky',
      description: 'A tool that always throws.',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => {
        throw new Error('FLAKY_TOOL_BOOM');
      },
    });

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Call the flaky tool.',
      tools: { flaky: flakyTool },
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        // Turn 1: call the failing tool.
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_flaky', name: 'flaky', arguments: {} }] },
        );
        // Turn 2: the error result is fed back -> model recovers with text.
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_flaky', hasToolResult: true },
          { content: 'The tool failed, so I recovered gracefully.' },
        );
      },
    });

    // The run did not crash: it completed with the recovery text.
    const text = await output.text;
    expect(text).toContain('recovered gracefully');

    // Two model turns: the failing tool call, then the recovery turn.
    expect(requests).toHaveLength(2);

    // The thrown error was reported as a tool result on the next request, keyed
    // to the original tool call id.
    const turn2Messages = requests[1]?.body?.messages ?? [];
    const toolMessage = turn2Messages.find(message => (message as { role?: string }).role === 'tool') as
      { tool_call_id?: string; content?: unknown } | undefined;
    expect(toolMessage?.tool_call_id).toBe('call_flaky');
    // The tool result content references the failure (not a success payload).
    expect(JSON.stringify(toolMessage?.content)).toMatch(/error|fail|boom/i);
  });

  it('rejects a call to an unknown tool and reports it back to the model', async () => {
    const realTool = createTool({
      id: 'real_tool',
      description: 'A real registered tool.',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => ({ ok: true }),
    });

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Call a tool.',
      tools: { real_tool: realTool },
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        // Turn 1: the model hallucinates a tool that is not registered.
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_ghost', name: 'nonexistent_tool', arguments: {} }] },
        );
        // Turn 2: after the not-found result is reported, the model wraps up.
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'That tool does not exist; using a real one.' });
      },
    });

    // The loop surfaced the unknown-tool failure and continued to a second turn
    // rather than crashing.
    expect(requests).toHaveLength(2);

    const turn2Messages = requests[1]?.body?.messages ?? [];
    const toolMessage = turn2Messages.find(message => (message as { role?: string }).role === 'tool') as
      { tool_call_id?: string; content?: unknown } | undefined;
    expect(toolMessage?.tool_call_id).toBe('call_ghost');

    const text = await output.text;
    expect(text).toContain('does not exist');
  });
});
