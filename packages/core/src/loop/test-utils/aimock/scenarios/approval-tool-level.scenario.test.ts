import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runApprovalScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: tool-level `requireApproval` flag.
 *
 * Unlike stream-level `requireToolApproval: true` (which gates ALL tool calls),
 * `requireApproval: true` on a tool definition gates only THAT tool. Other tools
 * execute without approval. This scenario proves only the flagged tool suspends.
 */
describe('AIMock loop scenario: tool-level requireApproval', () => {
  const getMock = useLoopScenarioAimock();

  // Tool WITHOUT approval — should execute freely.
  const makeReadTool = () =>
    createTool({
      id: 'read_file',
      description: 'Read a file.',
      inputSchema: z.object({ path: z.string() }),
      outputSchema: z.object({ content: z.string() }),
      execute: async ({ path }) => ({ content: `FILE_CONTENT:${path}` }),
    });

  // Tool WITH approval — should suspend before execution.
  const makeDeleteTool = () =>
    createTool({
      id: 'delete_file',
      description: 'Delete a file.',
      inputSchema: z.object({ path: z.string() }),
      outputSchema: z.object({ deleted: z.boolean() }),
      requireApproval: true,
      execute: async ({ path }) => ({ deleted: true }),
    });

  it('only the tool with requireApproval suspends; other tools execute freely', async () => {
    // Turn 1: model calls read_file (no approval) then delete_file (approval).
    // Turn 2: after both execute, model produces final text.
    const { output, approvals, requests } = await runApprovalScenario({
      llm: getMock(),
      prompt: 'Read config.yaml then delete it.',
      tools: { read_file: makeReadTool(), delete_file: makeDeleteTool() },
      stopWhen: stepCountIs(5),
      decision: () => true, // approve all
      requireToolApproval: false, // Only tool-level requireApproval
      fixtures: llm => {
        // Turn 1: model calls both tools.
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              { id: 'call_read', name: 'read_file', arguments: { path: 'config.yaml' } },
              { id: 'call_delete', name: 'delete_file', arguments: { path: 'config.yaml' } },
            ],
          },
        );
        // Turn 2: model produces final answer after receiving both tool results.
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'I read and deleted config.yaml.' });
      },
    });

    // Only delete_file should have required approval.
    expect(approvals).toHaveLength(1);
    expect(approvals[0]).toBe('approve:call_delete');

    // The model was invoked twice: initial tool-call turn + post-result turn.
    expect(requests.length).toBeGreaterThanOrEqual(2);

    // The final output includes the model's post-result text.
    const text = await output.text;
    expect(text).toContain('read and deleted');
  });
});
