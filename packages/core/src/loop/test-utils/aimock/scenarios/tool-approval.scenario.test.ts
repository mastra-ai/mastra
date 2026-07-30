import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runApprovalScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: tool approval + suspend/resume.
 *
 * With `requireToolApproval: true` the loop suspends before executing a tool,
 * emits a `tool-call-approval` chunk, and persists a snapshot. The run is then
 * resumed via approve/decline. These scenarios prove the suspend → resume →
 * continue path keeps message ordering and tool plumbing intact across the
 * snapshot boundary.
 */
describe('AIMock loop scenario: tool approval suspend/resume', () => {
  const getMock = useLoopScenarioAimock();

  const makeLookupTool = () =>
    createTool({
      id: 'lookup_status',
      description: 'Look up a status payload for a query.',
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({ status: z.string() }),
      execute: async ({ query }) => ({ status: `STATUS_OK:${query}` }),
    });

  it('approves a suspended tool call, executes it, then completes', async () => {
    const { output, chunks, approvals, requests } = await runApprovalScenario({
      llm: getMock(),
      prompt: 'Look up the status for query alpha.',
      tools: { lookup_status: makeLookupTool() },
      stopWhen: stepCountIs(5),
      decision: () => true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_lookup_alpha', name: 'lookup_status', arguments: { query: 'alpha' } }] },
        );
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_lookup_alpha', hasToolResult: true },
          { content: 'The status for alpha is STATUS_OK:alpha.' },
        );
      },
    });

    // The loop suspended for exactly one approval, which we approved.
    expect(approvals).toEqual(['approve:call_lookup_alpha']);

    // The approval chunk was surfaced before resume.
    expect(chunks.some(chunk => chunk.type === 'tool-call-approval')).toBe(true);

    // After approval the tool executed and the model produced its final answer.
    const text = await output.text;
    expect(text).toContain('STATUS_OK:alpha');

    // Two model turns total: the tool-call turn and the post-result turn. The
    // approval pause does not insert an extra model request.
    expect(requests).toHaveLength(2);

    // The post-resume request carries the executed tool result keyed to the
    // original tool call id.
    const turn2Messages = requests[1]?.body?.messages ?? [];
    const toolMessage = turn2Messages.find(message => (message as { role?: string }).role === 'tool') as
      | { tool_call_id?: string }
      | undefined;
    expect(toolMessage?.tool_call_id).toBe('call_lookup_alpha');
  });

  it('declines a suspended tool call and reports the denial back to the model', async () => {
    const { output, approvals, requests } = await runApprovalScenario({
      llm: getMock(),
      prompt: 'Look up the status for query beta.',
      tools: { lookup_status: makeLookupTool() },
      stopWhen: stepCountIs(5),
      decision: () => false,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_lookup_beta', name: 'lookup_status', arguments: { query: 'beta' } }] },
        );
        // After the decline is reported as the tool result, the model wraps up.
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Understood, I will not look that up.' });
      },
    });

    expect(approvals).toEqual(['decline:call_lookup_beta']);

    // A declined tool must NOT produce its real execution payload downstream.
    const turn2Messages = requests[1]?.body?.messages ?? [];
    const serialized = JSON.stringify(turn2Messages);
    expect(serialized).not.toContain('STATUS_OK:beta');

    const text = await output.text;
    expect(text).toContain('will not look that up');
  });
});
