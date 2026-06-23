import { describe, expect, it } from 'vitest';
import { recordingTool, runStoredToolMockScenario } from './scenario-helpers';

/**
 * BDD scenario: tool mocks declared on a PERSISTED dataset item are resolved
 * when the experiment runs by `datasetId` (the Studio path).
 *
 * Given a dataset item saved to storage with a mock for
 *   getWeather({ city: 'Seattle' }) -> { tempF: 52 }
 * When an experiment runs by `datasetId` (no inline data) and the model calls
 *   getWeather with those exact args
 * Then the mock is read off the stored DatasetItemRow, the mocked output is
 *      served, the real tool never executes, and the run succeeds.
 *
 * This exercises the storage-backed resolution branch in `runExperiment`
 * (index.ts: `items = versionItems.map(v => ({ ..., toolMocks: v.toolMocks }))`),
 * which the inline-data scenarios do not cover.
 */
describe('Tool mock scenario: stored dataset item tool mock served', () => {
  it('resolves toolMocks from a persisted dataset item and serves the mock', async () => {
    const liveLog: string[] = [];

    const { summary, item } = await runStoredToolMockScenario({
      tools: { getWeather: recordingTool('getWeather', liveLog) },
      turns: [
        { toolCalls: [{ id: 'c1', toolName: 'getWeather', args: { city: 'Seattle' } }] },
        { text: 'It is 52F in Seattle.' },
      ],
      toolMocks: [{ toolName: 'getWeather', args: { city: 'Seattle' }, output: { tempF: 52 } }],
    });

    // Then: the stored mock resolved, the live tool never ran, run succeeded.
    expect(summary.status).toBe('completed');
    expect(summary.succeededCount).toBe(1);
    expect(item.error).toBeNull();
    expect(liveLog).toEqual([]);

    expect(item.toolMockReport?.served).toHaveLength(1);
    expect(item.toolMockReport?.served[0]).toMatchObject({
      toolName: 'getWeather',
      args: { city: 'Seattle' },
    });
    expect(item.toolMockReport?.failure).toBeUndefined();
    expect(item.toolMockReport?.unconsumed).toEqual([]);
  });

  it('fails the item when a stored mock is called with mismatched args', async () => {
    const liveLog: string[] = [];

    const { summary, item } = await runStoredToolMockScenario({
      tools: { getWeather: recordingTool('getWeather', liveLog) },
      turns: [
        // Model calls with different args than the stored mock declares.
        { toolCalls: [{ id: 'c1', toolName: 'getWeather', args: { city: 'Paris' } }] },
        { text: 'unreachable' },
      ],
      toolMocks: [{ toolName: 'getWeather', args: { city: 'Seattle' }, output: { tempF: 52 } }],
    });

    // Then: strict mismatch fails the item; the live tool still never ran.
    expect(summary.failedCount).toBe(1);
    expect(item.error?.code).toBe('TOOL_MOCK_MISMATCH');
    expect(liveLog).toEqual([]);
    expect(item.toolMockReport?.unconsumed).toHaveLength(1);
  });
});
