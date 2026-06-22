import { describe, expect, it } from 'vitest';
import { recordingTool, runToolMockScenario } from './scenario-helpers';

/**
 * BDD scenario: a matching item tool-mock is served instead of running the tool.
 *
 * Given an agent with a `getWeather` tool and a dataset item that mocks
 *   getWeather({ city: 'Seattle' }) -> { tempF: 52 }
 * When the model calls getWeather with those exact args
 * Then the mocked output is served, the real tool never executes, and the
 *      run completes successfully with the call recorded in the report.
 */
describe('Tool mock scenario: item tool mock served', () => {
  it('serves the mocked output and skips live tool execution', async () => {
    const liveLog: string[] = [];

    const result = await runToolMockScenario({
      tools: { getWeather: recordingTool('getWeather', liveLog) },
      turns: [
        { toolCalls: [{ id: 'c1', toolName: 'getWeather', args: { city: 'Seattle' } }] },
        { text: 'It is 52F in Seattle.' },
      ],
      toolMocks: [{ toolName: 'getWeather', args: { city: 'Seattle' }, output: { tempF: 52 } }],
    });

    // Then: no error, the live tool never ran, and the report shows it served.
    expect(result.error).toBeNull();
    expect(liveLog).toEqual([]);

    expect(result.toolMockReport?.served).toHaveLength(1);
    expect(result.toolMockReport?.served[0]).toMatchObject({
      toolName: 'getWeather',
      args: { city: 'Seattle' },
    });
    expect(result.toolMockReport?.failure).toBeUndefined();
    expect(result.toolMockReport?.unconsumed).toEqual([]);
  });

  it('matches args independent of object key order', async () => {
    const liveLog: string[] = [];

    const result = await runToolMockScenario({
      tools: { search: recordingTool('search', liveLog) },
      turns: [{ toolCalls: [{ id: 'c1', toolName: 'search', args: { q: 'mastra', limit: 5 } }] }, { text: 'done' }],
      // Mock declares the keys in the opposite order; strict matching is key-order independent.
      toolMocks: [{ toolName: 'search', args: { limit: 5, q: 'mastra' }, output: { hits: [] } }],
    });

    expect(result.error).toBeNull();
    expect(liveLog).toEqual([]);
    expect(result.toolMockReport?.served).toHaveLength(1);
  });
});
