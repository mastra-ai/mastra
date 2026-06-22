import { describe, expect, it } from 'vitest';
import { recordingTool, runToolMockScenario } from './scenario-helpers';

/**
 * BDD scenario: repeated (toolName, args) mocks are consumed in declared order.
 *
 * Given two mocks for the SAME tool and args that return different outputs
 * When the model calls that tool twice with those args
 * Then the first call gets the first mock and the second gets the second mock,
 *      draining the queue top-to-bottom; the live tool never runs.
 *
 * This proves ordered consumption end-to-end through the real loop with
 * `toolCallConcurrency: 1` (which the executor forces when mocks are present).
 */
describe('Tool mock scenario: ordered consumption of repeated mocks', () => {
  it('serves repeated same-args mocks in declared order across calls', async () => {
    const liveLog: string[] = [];

    const result = await runToolMockScenario({
      tools: { appendLine: recordingTool('appendLine', liveLog) },
      turns: [
        { toolCalls: [{ id: 'c1', toolName: 'appendLine', args: { file: 'log.txt' } }] },
        { toolCalls: [{ id: 'c2', toolName: 'appendLine', args: { file: 'log.txt' } }] },
        { text: 'done' },
      ],
      toolMocks: [
        { toolName: 'appendLine', args: { file: 'log.txt' }, output: { written: 'first' } },
        { toolName: 'appendLine', args: { file: 'log.txt' }, output: { written: 'second' } },
      ],
    });

    expect(result.error).toBeNull();
    expect(liveLog).toEqual([]);

    // Both mocks consumed, in declared order (mockIndex 0 then 1), none left over.
    expect(result.toolMockReport?.served.map(s => s.mockIndex)).toEqual([0, 1]);
    expect(result.toolMockReport?.unconsumed).toEqual([]);
    expect(result.toolMockReport?.failure).toBeUndefined();
  });

  it('reports unconsumed mocks without failing when the tool is called fewer times', async () => {
    const liveLog: string[] = [];

    const result = await runToolMockScenario({
      tools: { appendLine: recordingTool('appendLine', liveLog) },
      turns: [{ toolCalls: [{ id: 'c1', toolName: 'appendLine', args: { file: 'log.txt' } }] }, { text: 'done' }],
      toolMocks: [
        { toolName: 'appendLine', args: { file: 'log.txt' }, output: { written: 'first' } },
        { toolName: 'appendLine', args: { file: 'log.txt' }, output: { written: 'second' } },
      ],
    });

    // Item passes; the second mock is reported as unconsumed (report-only, not a failure).
    expect(result.error).toBeNull();
    expect(result.toolMockReport?.served.map(s => s.mockIndex)).toEqual([0]);
    expect(result.toolMockReport?.unconsumed.map(u => u.mockIndex)).toEqual([1]);
    expect(result.toolMockReport?.failure).toBeUndefined();
  });

  it('keeps per-(tool,args) order when another tool call happens between the repeats', async () => {
    const liveLog: string[] = [];

    const result = await runToolMockScenario({
      tools: {
        appendLine: recordingTool('appendLine', liveLog),
        lookupOrder: recordingTool('lookupOrder', liveLog),
      },
      turns: [
        // First appendLine repeat...
        { toolCalls: [{ id: 'c1', toolName: 'appendLine', args: { file: 'log.txt' } }] },
        // ...an UNRELATED live tool call in between...
        { toolCalls: [{ id: 'c2', toolName: 'lookupOrder', args: { id: 'A-1' } }] },
        // ...then the second appendLine repeat.
        { toolCalls: [{ id: 'c3', toolName: 'appendLine', args: { file: 'log.txt' } }] },
        { text: 'done' },
      ],
      toolMocks: [
        { toolName: 'appendLine', args: { file: 'log.txt' }, output: { written: 'first' } },
        { toolName: 'appendLine', args: { file: 'log.txt' }, output: { written: 'second' } },
      ],
    });

    expect(result.error).toBeNull();

    // The interleaved tool ran live; the mocked appendLine repeats never ran live.
    expect(liveLog).toEqual(['lookupOrder']);

    // Both appendLine mocks consumed in declared order despite the call in between;
    // consumption order is tracked per (toolName, args), not globally across tools.
    const appendServed = result.toolMockReport?.served.filter(s => s.toolName === 'appendLine');
    expect(appendServed?.map(s => s.mockIndex)).toEqual([0, 1]);
    expect(result.toolMockReport?.unconsumed).toEqual([]);
    expect(result.toolMockReport?.liveCalls).toEqual([{ toolName: 'lookupOrder', args: { id: 'A-1' } }]);
    expect(result.toolMockReport?.failure).toBeUndefined();
  });
});
