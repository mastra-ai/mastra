import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runApprovalScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: concurrent approval requests.
 *
 * When a single turn produces multiple tool calls that each require approval
 * (either via tool-level `requireApproval` or a conditional `requireToolApproval`),
 * the loop must suspend on ALL of them, not just the first. This scenario proves
 * that:
 * 1. All tool calls requiring approval are surfaced as separate approval chunks.
 * 2. Approving all of them allows the loop to complete.
 * 3. Declining one while approving another still lets the non-declined tool execute.
 */
describe('AIMock loop scenario: concurrent approval requests', () => {
  const getMock = useLoopScenarioAimock();

  // Two destructive tools that both require approval.
  const makeDeleteTool = () =>
    createTool({
      id: 'delete_file',
      description: 'Delete a file.',
      inputSchema: z.object({ path: z.string() }),
      outputSchema: z.object({ deleted: z.boolean() }),
      requireApproval: true,
      execute: async () => ({ deleted: true }),
    });

  const makeRenameTool = () =>
    createTool({
      id: 'rename_file',
      description: 'Rename a file.',
      inputSchema: z.object({ from: z.string(), to: z.string() }),
      outputSchema: z.object({ renamed: z.boolean() }),
      requireApproval: true,
      execute: async () => ({ renamed: true }),
    });

  const makeReadTool = () =>
    createTool({
      id: 'read_file',
      description: 'Read a file.',
      inputSchema: z.object({ path: z.string() }),
      outputSchema: z.object({ content: z.string() }),
      execute: async ({ path }) => ({ content: `FILE_CONTENT:${path}` }),
    });

  it('all concurrent tool calls requiring approval are surfaced and approved individually', async () => {
    const { output, approvals, requests } = await runApprovalScenario({
      llm: getMock(),
      prompt: 'Delete old.txt and rename new.txt to final.txt.',
      tools: { delete_file: makeDeleteTool(), rename_file: makeRenameTool() },
      stopWhen: stepCountIs(5),
      decision: () => true, // approve all
      requireToolApproval: false, // Only tool-level requireApproval
      fixtures: llm => {
        // Turn 1: model calls both destructive tools in parallel.
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              { id: 'call_delete_1', name: 'delete_file', arguments: { path: 'old.txt' } },
              { id: 'call_rename_1', name: 'rename_file', arguments: { from: 'new.txt', to: 'final.txt' } },
            ],
          },
        );
        // Turn 2: after both approved + executed, model produces final text.
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          { content: 'I deleted old.txt and renamed new.txt to final.txt.' },
        );
      },
    });

    expect(approvals).toHaveLength(2);
    expect(approvals).toContain('approve:call_delete_1');
    expect(approvals).toContain('approve:call_rename_1');

    // Model invoked at least twice (initial + post-approval).
    expect(requests.length).toBeGreaterThanOrEqual(2);
    const text = await output.text;
    expect(text).toBeTruthy();
  });

  it('mixing approved and declined concurrent requests lets approved tools execute', async () => {
    const { output, approvals } = await runApprovalScenario({
      llm: getMock(),
      prompt: 'Read config.yaml, delete old.txt, and rename new.txt.',
      tools: {
        read_file: makeReadTool(),
        delete_file: makeDeleteTool(),
        rename_file: makeRenameTool(),
      },
      stopWhen: stepCountIs(5),
      decision: ({ toolCallId }: { toolCallId: string }) => {
        // Approve rename, decline delete.
        return toolCallId.includes('rename');
      },
      requireToolApproval: false,
      fixtures: llm => {
        // Turn 1: model calls read (no approval), delete (approval), rename (approval).
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              { id: 'call_read_1', name: 'read_file', arguments: { path: 'config.yaml' } },
              { id: 'call_delete_1', name: 'delete_file', arguments: { path: 'old.txt' } },
              { id: 'call_rename_1', name: 'rename_file', arguments: { from: 'new.txt', to: 'final.txt' } },
            ],
          },
        );
        // Turn 2: after approvals resolved, model produces final text.
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          { content: 'Read config.yaml, renamed new.txt but could not delete old.txt.' },
        );
      },
    });

    expect(approvals).toHaveLength(2);

    const approvedApprovals = approvals.filter(a => a.startsWith('approve:'));
    const declinedApprovals = approvals.filter(a => a.startsWith('decline:'));
    expect(approvedApprovals).toHaveLength(1);
    expect(approvedApprovals[0]).toContain('call_rename');
    expect(declinedApprovals).toHaveLength(1);
    expect(declinedApprovals[0]).toContain('call_delete');

    expect(approvals).not.toContain(expect.stringContaining('call_read'));

    const text = await output.text;
    expect(text).toBeTruthy();
  });

  it('three concurrent approval-gated tool calls all surface individually', async () => {
    const makeArchiveTool = () =>
      createTool({
        id: 'archive_file',
        description: 'Archive a file.',
        inputSchema: z.object({ path: z.string() }),
        outputSchema: z.object({ archived: z.boolean() }),
        requireApproval: true,
        execute: async () => ({ archived: true }),
      });

    const { output, approvals } = await runApprovalScenario({
      llm: getMock(),
      prompt: 'Delete old.txt, rename new.txt, and archive data.csv.',
      tools: {
        delete_file: makeDeleteTool(),
        rename_file: makeRenameTool(),
        archive_file: makeArchiveTool(),
      },
      stopWhen: stepCountIs(6),
      decision: () => true, // approve all
      requireToolApproval: false,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              { id: 'call_delete', name: 'delete_file', arguments: { path: 'old.txt' } },
              { id: 'call_rename', name: 'rename_file', arguments: { from: 'new.txt', to: 'final.txt' } },
              { id: 'call_archive', name: 'archive_file', arguments: { path: 'data.csv' } },
            ],
          },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Deleted, renamed, and archived.' });
      },
    });

    expect(approvals).toHaveLength(3);
    expect(approvals).toContain('approve:call_delete');
    expect(approvals).toContain('approve:call_rename');
    expect(approvals).toContain('approve:call_archive');

    const text = await output.text;
    expect(text).toBeTruthy();
  });
});
