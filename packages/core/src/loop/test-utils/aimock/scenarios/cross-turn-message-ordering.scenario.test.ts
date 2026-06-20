import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: cross-turn message ordering for multi-tool turns.
 *
 * Turn 1 emits two tool calls. The loop executes both and must round-trip both
 * tool results into the turn-2 request, each keyed to its originating tool call
 * id. We assert both results appear with the correct ids so a reordering or
 * id-mismatch regression is caught.
 */
describe('AIMock loop scenario: cross-turn message ordering', () => {
  const getMock = useLoopScenarioAimock();

  it('round-trips multiple tool results into the next request with correct ids', async () => {
    const getCity = createTool({
      id: 'get_city',
      description: 'Return a city name.',
      inputSchema: z.object({}),
      outputSchema: z.object({ city: z.string() }),
      execute: async () => ({ city: 'CITY_PARIS' }),
    });

    const getTemp = createTool({
      id: 'get_temp',
      description: 'Return a temperature.',
      inputSchema: z.object({}),
      outputSchema: z.object({ temp: z.string() }),
      execute: async () => ({ temp: 'TEMP_21C' }),
    });

    const { requests, output } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Get the city and temperature.',
      tools: { get_city: getCity, get_temp: getTemp },
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        // Turn 1: two tool calls in a single assistant turn.
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              { id: 'call_city', name: 'get_city', arguments: {} },
              { id: 'call_temp', name: 'get_temp', arguments: {} },
            ],
          },
        );
        // Turn 2: both results are present -> finish.
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done: CITY_PARIS at TEMP_21C.' });
      },
    });

    expect(requests).toHaveLength(2);

    const turn2Messages = requests[1]?.body?.messages ?? [];
    const toolMessages = turn2Messages.filter(
      message => (message as { role?: string }).role === 'tool',
    ) as Array<{ tool_call_id?: string; content?: unknown }>;

    // Both tool results must round-trip into the next request, each keyed to
    // its originating tool call id.
    const idsToResults = new Map(
      toolMessages.map(message => [message.tool_call_id, JSON.stringify(message.content)] as const),
    );
    expect(idsToResults.has('call_city')).toBe(true);
    expect(idsToResults.has('call_temp')).toBe(true);
    expect(idsToResults.get('call_city')).toContain('CITY_PARIS');
    expect(idsToResults.get('call_temp')).toContain('TEMP_21C');

    const text = await output.text;
    expect(text).toContain('CITY_PARIS');
    expect(text).toContain('TEMP_21C');
  });
});
