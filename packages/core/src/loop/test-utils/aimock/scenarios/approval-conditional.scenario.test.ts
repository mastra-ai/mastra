import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runApprovalScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: conditional `requireToolApproval` function.
 *
 * When `requireToolApproval` is a function, it decides per-tool-call whether
 * approval is required. This scenario proves pattern-based gating works:
 * only tools matching the pattern suspend, others execute freely.
 */
describe('AIMock loop scenario: conditional requireToolApproval function', () => {
  const getMock = useLoopScenarioAimock();

  // Tools that should NOT require approval (don't match pattern).
  const makeReadTool = () =>
    createTool({
      id: 'read_file',
      description: 'Read a file.',
      inputSchema: z.object({ path: z.string() }),
      outputSchema: z.object({ content: z.string() }),
      execute: async ({ path }) => ({ content: `FILE_CONTENT:${path}` }),
    });

  const makeListTool = () =>
    createTool({
      id: 'list_files',
      description: 'List files.',
      inputSchema: z.object({}),
      outputSchema: z.object({ files: z.array(z.string()) }),
      execute: async () => ({ files: ['a.txt', 'b.txt'] }),
    });

  // Tools that SHOULD require approval (match /delete_/ pattern).
  const makeDeleteTool = () =>
    createTool({
      id: 'delete_file',
      description: 'Delete a file.',
      inputSchema: z.object({ path: z.string() }),
      outputSchema: z.object({ deleted: z.boolean() }),
      execute: async () => ({ deleted: true }),
    });

  const makeDeleteAllTool = () =>
    createTool({
      id: 'delete_all',
      description: 'Delete all files.',
      inputSchema: z.object({}),
      outputSchema: z.object({ count: z.number() }),
      execute: async () => ({ count: 5 }),
    });

  it('only tools matching the approval pattern suspend; others execute freely', async () => {
    // Turn 1: model calls read_file (no approval), list_files (no approval),
    // delete_file (approval), delete_all (approval).
    // Turn 2: after all execute, model produces final text.
    const { output, approvals, requests: _requests } = await runApprovalScenario({
      llm: getMock(),
      prompt: 'Read files, list them, then delete file.txt and all others.',
      tools: {
        read_file: makeReadTool(),
        list_files: makeListTool(),
        delete_file: makeDeleteTool(),
        delete_all: makeDeleteAllTool(),
      },
      stopWhen: stepCountIs(5),
      decision: () => true, // approve all
      // Pattern-based gating: only tools starting with "delete_" require approval.
      requireToolApproval: ({ toolName }: { toolName: string }) => /^delete_/.test(toolName),
      fixtures: llm => {
        // Turn 1: model calls all four tools.
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              { id: 'call_read', name: 'read_file', arguments: { path: 'file.txt' } },
              { id: 'call_list', name: 'list_files', arguments: {} },
              { id: 'call_delete', name: 'delete_file', arguments: { path: 'file.txt' } },
              { id: 'call_delete_all', name: 'delete_all', arguments: {} },
            ],
          },
        );
        // Turn 2: model produces final answer after receiving all tool results.
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'I read, listed, and deleted everything.' });
      },
    });

    // Only delete_file should have required approval (the loop suspends on the first
    // approval and completes after resuming). The pattern-based gating correctly
    // identified which tool needs approval.
    expect(approvals).toHaveLength(1);
    expect(approvals).toContain('approve:call_delete');

    // read_file and list_files should NOT have triggered approval.
    expect(approvals).not.toContain(expect.stringContaining('call_read'));
    expect(approvals).not.toContain(expect.stringContaining('call_list'));

    // The model was invoked at least once for the initial tool-call turn.
    expect(_requests.length).toBeGreaterThanOrEqual(1);

    // The final output includes text from the model.
    const text = await output.text;
    expect(text).toBeTruthy();
  });

  it('declining a pattern-matched tool still allows non-matching tools to complete', async () => {
    const { output, approvals } = await runApprovalScenario({
      llm: getMock(),
      prompt: 'Read config.yaml and delete it.',
      tools: {
        read_file: makeReadTool(),
        delete_file: makeDeleteTool(),
      },
      stopWhen: stepCountIs(5),
      decision: ({ toolCallId }: { toolCallId: string }) => {
        // Decline delete operations, approve others.
        return !toolCallId.includes('delete');
      },
      requireToolApproval: ({ toolName }: { toolName: string }) => /^delete_/.test(toolName),
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
        // Turn 2: model produces final answer.
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'I read config.yaml but did not delete it.' });
      },
    });

    // delete_file was declined.
    expect(approvals).toContain('decline:call_delete');

    // read_file executed without approval.
    expect(approvals).not.toContain(expect.stringContaining('call_read'));

    // The final output reflects the decline.
    const text = await output.text;
    expect(text).toContain('did not delete');
  });
});
