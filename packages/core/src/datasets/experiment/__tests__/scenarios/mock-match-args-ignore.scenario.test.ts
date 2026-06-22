import { describe, expect, it } from 'vitest';
import { recordingTool, runToolMockScenario } from './scenario-helpers';

/**
 * BDD scenario: `matchArgs: 'ignore'` serves the mock even when the call args
 * differ from what was recorded.
 *
 * This is the sub-agent / free-text escape hatch: an `agent-*` (or any) tool
 * whose args are LLM-authored at run time (e.g. a `prompt`) would be brittle
 * under strict deep-equal matching. With `matchArgs: 'ignore'` the mock matches
 * on tool name alone, so a differently-worded call still serves the recorded
 * output instead of failing with TOOL_MOCK_MISMATCH.
 *
 * Given an `agent-balanceAgent` mock recorded with one prompt, set to ignore args
 * When the model calls it with a DIFFERENT prompt (plus runtime-injected fields)
 * Then the mock still serves, the live sub-agent never runs, and the item passes.
 */
describe('Tool mock scenario: matchArgs ignore', () => {
  it('serves the mock even when the call args differ from the recorded args', async () => {
    const liveLog: string[] = [];

    const result = await runToolMockScenario({
      tools: { 'agent-balanceAgent': recordingTool('agent-balanceAgent', liveLog) },
      turns: [
        // The model authors a different prompt than the one recorded in the mock.
        { toolCalls: [{ id: 'c1', toolName: 'agent-balanceAgent', args: { prompt: 'what is the balance now?' } }] },
        { text: 'The balance is $100.' },
      ],
      toolMocks: [
        {
          toolName: 'agent-balanceAgent',
          args: { prompt: 'authored at record time' },
          output: { text: 'YJ: $100' },
          matchArgs: 'ignore',
        },
      ],
    });

    // Then: served despite the arg mismatch; the live tool never ran; no failure.
    expect(result.error).toBeNull();
    expect(liveLog).toEqual([]);
    expect(result.toolMockReport?.served).toHaveLength(1);
    expect(result.toolMockReport?.served[0]).toMatchObject({ toolName: 'agent-balanceAgent' });
    expect(result.toolMockReport?.failure).toBeUndefined();
  });

  it('still consumes ignore mocks in declared order and fails EXHAUSTED when overcalled', async () => {
    const liveLog: string[] = [];

    const result = await runToolMockScenario({
      tools: { 'agent-sub': recordingTool('agent-sub', liveLog) },
      turns: [
        // Three calls with different args; only two ignore mocks are provided.
        { toolCalls: [{ id: 'c1', toolName: 'agent-sub', args: { prompt: 'a' } }] },
        { toolCalls: [{ id: 'c2', toolName: 'agent-sub', args: { prompt: 'b' } }] },
        { toolCalls: [{ id: 'c3', toolName: 'agent-sub', args: { prompt: 'c' } }] },
        { text: 'done' },
      ],
      toolMocks: [
        { toolName: 'agent-sub', args: {}, output: { text: 'first' }, matchArgs: 'ignore' },
        { toolName: 'agent-sub', args: {}, output: { text: 'second' }, matchArgs: 'ignore' },
      ],
    });

    // The first two calls serve in order; the third exhausts the queue and fails
    // deterministically — the abort halts the loop before any live execution.
    expect(result.error?.code).toBe('TOOL_MOCK_EXHAUSTED');
    expect(liveLog).toEqual([]);
    expect(result.toolMockReport?.served.map(s => s.mockIndex)).toEqual([0, 1]);
    expect(result.toolMockReport?.failure).toMatchObject({
      code: 'TOOL_MOCK_EXHAUSTED',
      toolName: 'agent-sub',
    });
  });
});
