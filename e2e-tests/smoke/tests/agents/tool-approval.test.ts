import { describe, it, expect } from 'vitest';
import { streamAgent, fetchApi, parseSSEEvents } from '../utils.js';

describe('agent tool approval', () => {
  /**
   * Helper: stream a request to the approval-agent and extract
   * the tool-call-approval event's toolCallId and runId.
   */
  async function streamUntilApproval(): Promise<{
    events: any[];
    runId: string;
    toolCallId: string;
  }> {
    const { status, events } = await streamAgent('approval-agent', {
      messages: [
        {
          role: 'user',
          content: 'Greet someone named Alice using the needs-approval tool. You must use the tool.',
        },
      ],
    });

    expect(status).toBe(200);

    const approvalEvent = events.find((e: any) => e.type === 'tool-call-approval');
    expect(
      approvalEvent,
      'LLM did not trigger tool-call-approval — expected needs-approval tool to require approval',
    ).toBeDefined();

    // runId is always on the approval event itself
    expect(approvalEvent.runId, 'approval event missing runId').toBeDefined();

    return {
      events,
      runId: approvalEvent.runId,
      toolCallId: approvalEvent.payload.toolCallId,
    };
  }

  describe('approve tool call', () => {
    it('should pause on tool-call-approval and resume after approval', async () => {
      const { runId, toolCallId } = await streamUntilApproval();

      // Approve the tool call via streaming endpoint
      const res = await fetchApi('/api/agents/approval-agent/approve-tool-call', {
        method: 'POST',
        body: JSON.stringify({ runId, toolCallId }),
      });

      expect(res.status).toBe(200);

      const text = await res.text();
      const events = parseSSEEvents(text);

      // Should have tool-result with the greeting
      const toolResult = events.find((e: any) => e.type === 'tool-result');
      expect(toolResult, 'expected tool-result event after approval').toBeDefined();
      expect(toolResult.payload.toolName).toBe('needs-approval');
      expect(toolResult.payload.result.greeting).toContain('Alice');
    });
  });

  describe('decline tool call', () => {
    it('should pause on tool-call-approval and resume after decline', async () => {
      const { runId, toolCallId } = await streamUntilApproval();

      // Decline the tool call via streaming endpoint
      const res = await fetchApi('/api/agents/approval-agent/decline-tool-call', {
        method: 'POST',
        body: JSON.stringify({ runId, toolCallId }),
      });

      expect(res.status).toBe(200);

      const text = await res.text();
      const events = parseSSEEvents(text);

      // Should have tool-result indicating the tool was not approved
      const toolResult = events.find((e: any) => e.type === 'tool-result');
      expect(toolResult, 'expected tool-result event after decline').toBeDefined();
      expect(toolResult.payload.result).toBe('Tool call was not approved by the user');
    });
  });
});
