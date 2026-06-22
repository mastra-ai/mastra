import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: structured output composed with a tool loop.
 *
 * The loop runs a tool turn, then produces a final structured object validated
 * against a schema. This pins the composition of tool execution and structured
 * output, which is easy to break when either path changes.
 */
describe('AIMock loop scenario: structured output', () => {
  const getMock = useLoopScenarioAimock();

  it('returns a schema-valid object after a tool turn', async () => {
    const lookupTool = createTool({
      id: 'lookup_status',
      description: 'Look up a status payload for a query.',
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({ status: z.string() }),
      execute: async ({ query }) => ({ status: `STATUS_OK:${query}` }),
    });

    const schema = z.object({
      query: z.string(),
      status: z.string(),
    });

    const { output, requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Look up alpha and report the structured result.',
      tools: { lookup_status: lookupTool },
      stopWhen: stepCountIs(5),
      structuredOutput: { schema },
      fixtures: llm => {
        // Turn 1: the main model calls the tool.
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_lookup_alpha', name: 'lookup_status', arguments: { query: 'alpha' } }] },
        );
        // Turn 2: after the tool result, the request carries a json_schema
        // response format (structured output is applied inline on the main
        // model for OpenAI). The model returns the schema-valid JSON object as
        // its content.
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          { content: JSON.stringify({ query: 'alpha', status: 'STATUS_OK:alpha' }) },
        );
      },
    });

    // Two model turns: the tool call, then the structured-object turn.
    expect(requests.length).toBeGreaterThanOrEqual(2);

    // The tool result is plumbed back into the structured-object turn.
    const turn2Messages = (requests[1]?.body as any)?.messages ?? [];
    const toolMessage = turn2Messages.find((m: any) => m.role === 'tool');
    expect(JSON.stringify(toolMessage?.content)).toContain('STATUS_OK:alpha');

    const object = await (output as unknown as { object: Promise<unknown> }).object;
    expect(schema.parse(object)).toEqual({ query: 'alpha', status: 'STATUS_OK:alpha' });
  });
});
