import { describe, expect, it } from 'vitest';
import { TOOL_MOCK_EXHAUSTED } from '../../tool-mocks';
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

    const { item } = await runToolMockScenario({
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

    expect(item.error).toBeNull();
    expect(liveLog).toEqual([]);

    // Both mocks consumed, in declared order (mockIndex 0 then 1), none left over.
    expect(item.toolMockReport?.served.map(s => s.mockIndex)).toEqual([0, 1]);
    expect(item.toolMockReport?.unconsumed).toEqual([]);
    expect(item.toolMockReport?.failure).toBeUndefined();
  });

  it('reports unconsumed mocks without failing when the tool is called fewer times', async () => {
    const liveLog: string[] = [];

    const { item } = await runToolMockScenario({
      tools: { appendLine: recordingTool('appendLine', liveLog) },
      turns: [{ toolCalls: [{ id: 'c1', toolName: 'appendLine', args: { file: 'log.txt' } }] }, { text: 'done' }],
      toolMocks: [
        { toolName: 'appendLine', args: { file: 'log.txt' }, output: { written: 'first' } },
        { toolName: 'appendLine', args: { file: 'log.txt' }, output: { written: 'second' } },
      ],
    });

    // Item passes; the second mock is reported as unconsumed (report-only, not a failure).
    expect(item.error).toBeNull();
    expect(item.toolMockReport?.served.map(s => s.mockIndex)).toEqual([0]);
    expect(item.toolMockReport?.unconsumed.map(u => u.mockIndex)).toEqual([1]);
    expect(item.toolMockReport?.failure).toBeUndefined();
  });

  it('keeps per-(tool,args) order when another tool call happens between the repeats', async () => {
    const liveLog: string[] = [];

    const { item } = await runToolMockScenario({
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

    expect(item.error).toBeNull();

    // The interleaved tool ran live; the mocked appendLine repeats never ran live.
    expect(liveLog).toEqual(['lookupOrder']);

    // Both appendLine mocks consumed in declared order despite the call in between;
    // consumption order is tracked per (toolName, args), not globally across tools.
    const appendServed = item.toolMockReport?.served.filter(s => s.toolName === 'appendLine');
    expect(appendServed?.map(s => s.mockIndex)).toEqual([0, 1]);
    expect(item.toolMockReport?.unconsumed).toEqual([]);
    expect(item.toolMockReport?.liveCalls).toEqual([{ toolName: 'lookupOrder', args: { id: 'A-1' } }]);
    expect(item.toolMockReport?.failure).toBeUndefined();
  });

  it('drains each tool queue in its own declared order when two tools are interleaved', async () => {
    const liveLog: string[] = [];

    const { item } = await runToolMockScenario({
      tools: {
        writeFile: recordingTool('writeFile', liveLog),
        sendEmail: recordingTool('sendEmail', liveLog),
      },
      // Interleaved across separate turns: writeFile, sendEmail, sendEmail, writeFile.
      turns: [
        { toolCalls: [{ id: 'c1', toolName: 'writeFile', args: { path: 'a.txt' } }] },
        { toolCalls: [{ id: 'c2', toolName: 'sendEmail', args: { to: 'x@y.z' } }] },
        { toolCalls: [{ id: 'c3', toolName: 'sendEmail', args: { to: 'x@y.z' } }] },
        { toolCalls: [{ id: 'c4', toolName: 'writeFile', args: { path: 'a.txt' } }] },
        { text: 'done' },
      ],
      toolMocks: [
        // writeFile queue
        { toolName: 'writeFile', args: { path: 'a.txt' }, output: { written: 'wf-first' } },
        { toolName: 'writeFile', args: { path: 'a.txt' }, output: { written: 'wf-second' } },
        // sendEmail queue
        { toolName: 'sendEmail', args: { to: 'x@y.z' }, output: { sent: 'se-first' } },
        { toolName: 'sendEmail', args: { to: 'x@y.z' }, output: { sent: 'se-second' } },
      ],
    });

    expect(item.error).toBeNull();
    expect(liveLog).toEqual([]);

    // Each tool drains ITS OWN queue in declared order, independent of the other's
    // interleaved calls: writeFile -> [0, 1], sendEmail -> [2, 3].
    const served = item.toolMockReport?.served ?? [];
    expect(served.filter(s => s.toolName === 'writeFile').map(s => s.mockIndex)).toEqual([0, 1]);
    expect(served.filter(s => s.toolName === 'sendEmail').map(s => s.mockIndex)).toEqual([2, 3]);
    expect(item.toolMockReport?.unconsumed).toEqual([]);
    expect(item.toolMockReport?.failure).toBeUndefined();
  });

  it('fails with TOOL_MOCK_EXHAUSTED when a tool is called more times than it has mocks', async () => {
    const liveLog: string[] = [];

    const { item } = await runToolMockScenario({
      tools: { appendLine: recordingTool('appendLine', liveLog) },
      // Two mocks provided, but the tool is called three times with the same args.
      turns: [
        { toolCalls: [{ id: 'c1', toolName: 'appendLine', args: { file: 'log.txt' } }] },
        { toolCalls: [{ id: 'c2', toolName: 'appendLine', args: { file: 'log.txt' } }] },
        { toolCalls: [{ id: 'c3', toolName: 'appendLine', args: { file: 'log.txt' } }] },
        { text: 'done' },
      ],
      toolMocks: [
        { toolName: 'appendLine', args: { file: 'log.txt' }, output: { written: 'first' } },
        { toolName: 'appendLine', args: { file: 'log.txt' }, output: { written: 'second' } },
      ],
    });

    // The first two calls serve in order; the third has no remaining mock for
    // these (args matched but all consumed) so it fails EXHAUSTED — distinct from
    // a MISMATCH — and the abort prevents the tool from ever running live.
    expect(item.error?.code).toBe(TOOL_MOCK_EXHAUSTED);
    expect(item.output).toBeNull();
    expect(liveLog).toEqual([]);

    expect(item.toolMockReport?.served.map(s => s.mockIndex)).toEqual([0, 1]);
    expect(item.toolMockReport?.failure).toMatchObject({
      code: TOOL_MOCK_EXHAUSTED,
      toolName: 'appendLine',
      args: { file: 'log.txt' },
    });
  });
});
