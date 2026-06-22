import { describe, expect, it } from 'vitest';
import { recordingTool, runToolMockScenario } from './scenario-helpers';

/**
 * BDD scenario: tools without a mock still run live; mocking is opt-in per tool.
 *
 * Given an item that mocks only `getWeather`
 * When the model calls a mocked `getWeather` AND an un-mocked `lookupOrder`
 * Then getWeather is served from the mock, lookupOrder executes live, the item
 *      passes, and the report records the live call.
 */
describe('Tool mock scenario: unmocked tools run live', () => {
  it('serves the mocked tool and runs the unmocked tool live; item passes', async () => {
    const liveLog: string[] = [];

    const result = await runToolMockScenario({
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

    expect(result.error).toBeNull();

    // getWeather served from the mock (did not run live); lookupOrder ran live.
    expect(liveLog).toEqual(['lookupOrder']);

    expect(result.toolMockReport?.served).toHaveLength(1);
    expect(result.toolMockReport?.served[0]).toMatchObject({ toolName: 'getWeather' });
    expect(result.toolMockReport?.liveCalls).toEqual([{ toolName: 'lookupOrder', args: { id: 'A-1' } }]);
    expect(result.toolMockReport?.failure).toBeUndefined();
  });

  it('attaches no report and runs everything live when the item has no mocks', async () => {
    const liveLog: string[] = [];

    const result = await runToolMockScenario({
      tools: { lookupOrder: recordingTool('lookupOrder', liveLog) },
      turns: [{ toolCalls: [{ id: 'c1', toolName: 'lookupOrder', args: { id: 'A-1' } }] }, { text: 'done' }],
      // no toolMocks
    });

    expect(result.error).toBeNull();
    expect(liveLog).toEqual(['lookupOrder']);
    // Mock-free runs behave exactly as before: no report attached.
    expect(result.toolMockReport).toBeUndefined();
  });
});
