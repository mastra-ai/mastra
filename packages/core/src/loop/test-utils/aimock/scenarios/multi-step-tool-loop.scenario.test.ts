import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: multi-step tool loop composition (the mastracode
 * `task-patch-tools` / `task-inline-transitions` family).
 *
 * Turn 1 the model emits a tool call; the loop executes the tool and must feed
 * the tool result back to the model on turn 2 in the correct position/shape.
 * Turn 2 the model emits final text. We assert on both the emitted loop output
 * and the turn-2 request AIMock captured (proving the tool result round-tripped
 * into the next provider request).
 */
describeForAllEngines('AIMock loop scenario: multi-step tool loop', engine => {
  const getMock = useLoopScenarioAimock();

  it('feeds the turn-1 tool result into the turn-2 model request', async () => {
    const lookupTool = createTool({
      id: 'lookup_status',
      description: 'Look up a status payload for a query.',
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({ status: z.string() }),
      execute: async ({ query }) => ({ status: `STATUS_OK:${query}` }),
    });

    const { output, requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Look up the status for query alpha.',
      tools: { lookup_status: lookupTool },
      stopWhen: stepCountIs(5),
      engine,
      fixtures: llm => {
        // Turn 1: no tool result yet -> emit a tool call.
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              {
                id: 'call_lookup_alpha',
                name: 'lookup_status',
                arguments: { query: 'alpha' },
              },
            ],
          },
        );
        // Turn 2: the tool result for call_lookup_alpha is now present -> finish.
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_lookup_alpha', hasToolResult: true },
          { content: 'The status for alpha is STATUS_OK:alpha.' },
        );
      },
    });

    // The loop ran two model turns: tool call, then final text.
    expect(requests).toHaveLength(2);

    // Final emitted output reflects the turn-2 completion.
    const text = await output.text;
    expect(text).toContain('STATUS_OK:alpha');

    // The tool was actually executed in the loop.
    const toolResults = await output.toolResults;
    expect(toolResults).toHaveLength(1);
    expect(toolResults[0]?.payload.toolName).toBe('lookup_status');

    // Cross-turn plumbing: the turn-2 request must carry the executed tool
    // result so the model can produce its final answer.
    const turn2Messages = requests[1]?.body?.messages ?? [];
    const serializedTurn2 = JSON.stringify(turn2Messages);
    expect(serializedTurn2).toContain('STATUS_OK:alpha');

    // The tool-result message must reference the original tool call id.
    const toolMessage = turn2Messages.find(message => (message as { role?: string }).role === 'tool') as
      | { tool_call_id?: string }
      | undefined;
    expect(toolMessage?.tool_call_id).toBe('call_lookup_alpha');
  });
});
