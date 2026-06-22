import { describe, expect, it } from 'vitest';
import { TOOL_MOCK_MISMATCH } from '../../tool-mocks';
import { recordingTool, runToolMockScenario } from './scenario-helpers';

/**
 * BDD scenario: a mocked tool called with the wrong args fails the item
 * immediately and stops the agent before any later (side-effecting) tool runs.
 *
 * Given a mock for processRefund({ user: 'yj', amount: 100 })
 * When the model calls processRefund with a different amount, then would call
 *      a live `sendReceipt` tool on the next step
 * Then the item fails with TOOL_MOCK_MISMATCH and `sendReceipt` never executes.
 */
describe('Tool mock scenario: item tool mock mismatch aborts the run', () => {
  it('fails with TOOL_MOCK_MISMATCH and prevents a later live tool from running', async () => {
    const liveLog: string[] = [];

    const result = await runToolMockScenario({
      tools: {
        processRefund: recordingTool('processRefund', liveLog),
        sendReceipt: recordingTool('sendReceipt', liveLog),
      },
      turns: [
        // Model mis-calls the mocked tool (amount 999, not 100)...
        { toolCalls: [{ id: 'c1', toolName: 'processRefund', args: { user: 'yj', amount: 999 } }] },
        // ...and would call a side-effecting tool next if the run were not aborted.
        { toolCalls: [{ id: 'c2', toolName: 'sendReceipt', args: { user: 'yj' } }] },
        { text: 'done' },
      ],
      toolMocks: [{ toolName: 'processRefund', args: { user: 'yj', amount: 100 }, output: { ok: true } }],
    });

    // Then: deterministic coded failure, surfaced via error.code.
    expect(result.error?.code).toBe(TOOL_MOCK_MISMATCH);
    expect(result.output).toBeNull();

    // And: neither tool executed live — the abort halted the loop.
    expect(liveLog).toEqual([]);

    // And: the report names the failing call and leaves the mock unconsumed.
    expect(result.toolMockReport?.failure).toMatchObject({
      code: TOOL_MOCK_MISMATCH,
      toolName: 'processRefund',
      args: { user: 'yj', amount: 999 },
    });
    expect(result.toolMockReport?.served).toEqual([]);
    expect(result.toolMockReport?.unconsumed).toHaveLength(1);
  });
});
