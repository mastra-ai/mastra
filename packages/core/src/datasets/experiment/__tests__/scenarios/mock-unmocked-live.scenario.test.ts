import { describe, expect, it } from 'vitest';
import { EXPERIMENT_PATHS, recordingTool, runToolMockScenario } from './scenario-helpers';

/**
 * BDD scenario: tools without a mock still run live; mocking is opt-in per tool.
 *
 * Given an item that mocks only `getWeather`
 * When the model calls a mocked `getWeather` AND an un-mocked `lookupOrder`
 * Then getWeather is served from the mock, lookupOrder executes live, the item
 *      passes, and the report records the live call.
 */
describe.each(EXPERIMENT_PATHS)('Tool mock scenario: unmocked tools run live (%s)', path => {
  it('serves the mocked tool and runs the unmocked tool live; item passes', async () => {
    const liveLog: string[] = [];

    const { summary, item } = await runToolMockScenario({
      path,
      tools: {
        getWeather: recordingTool('getWeather', liveLog),
        lookupOrder: recordingTool('lookupOrder', liveLog),
      },
      turns: [
        {
          toolCalls: [
            { id: 'c1', toolName: 'getWeather', args: { city: 'Seattle' } },
            { id: 'c2', toolName: 'lookupOrder', args: { id: 'A-1' } },
          ],
        },
        { text: 'done' },
      ],
      toolMocks: [{ toolName: 'getWeather', args: { city: 'Seattle' }, output: { tempF: 52 } }],
    });

    expect(summary.succeededCount).toBe(1);
    expect(item.error).toBeNull();

    // getWeather served from the mock (did not run live); lookupOrder ran live.
    expect(liveLog).toEqual(['lookupOrder']);

    expect(item.toolMockReport?.served).toHaveLength(1);
    expect(item.toolMockReport?.served[0]).toMatchObject({ toolName: 'getWeather' });
    expect(item.toolMockReport?.liveCalls).toEqual([{ toolName: 'lookupOrder', args: { id: 'A-1' } }]);
    expect(item.toolMockReport?.failure).toBeUndefined();
  });

  it('attaches no report and runs everything live when the item has no mocks', async () => {
    const liveLog: string[] = [];

    const { item } = await runToolMockScenario({
      path,
      tools: { lookupOrder: recordingTool('lookupOrder', liveLog) },
      turns: [{ toolCalls: [{ id: 'c1', toolName: 'lookupOrder', args: { id: 'A-1' } }] }, { text: 'done' }],
      // no toolMocks
    });

    expect(item.error).toBeNull();
    expect(liveLog).toEqual(['lookupOrder']);
    // Mock-free runs behave exactly as before: no report attached.
    expect(item.toolMockReport).toBeNull();
  });
});
