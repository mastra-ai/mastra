import type { LLMock } from '@copilotkit/aimock';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runApprovalScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: concurrent approval requests.
 *
 * When a single turn produces several tool calls that each require approval
 * (tool-level `requireApproval`, or a run-wide `requireToolApproval`), the step
 * raises every approval request at once, before any of them is answered (#30152).
 * Calls that need no approval run straight away, and each approved call runs on
 * its own resume while the others stay parked.
 */
describeForAllEngines('AIMock loop scenario: concurrent approval requests', engine => {
  const getMock = useLoopScenarioAimock();

  const makeTools = (requireApproval: boolean, executed: string[]) => ({
    delete_file: createTool({
      id: 'delete_file',
      description: 'Delete a file.',
      inputSchema: z.object({ path: z.string() }),
      outputSchema: z.object({ deleted: z.boolean() }),
      requireApproval,
      execute: async () => {
        executed.push('delete_file');
        return { deleted: true };
      },
    }),
    rename_file: createTool({
      id: 'rename_file',
      description: 'Rename a file.',
      inputSchema: z.object({ from: z.string(), to: z.string() }),
      outputSchema: z.object({ renamed: z.boolean() }),
      requireApproval,
      execute: async () => {
        executed.push('rename_file');
        return { renamed: true };
      },
    }),
    read_file: createTool({
      id: 'read_file',
      description: 'Read a file.',
      inputSchema: z.object({ path: z.string() }),
      outputSchema: z.object({ content: z.string() }),
      execute: async ({ path }) => {
        executed.push('read_file');
        return { content: `FILE_CONTENT:${path}` };
      },
    }),
  });

  const deleteAndRename = (llm: LLMock) => {
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      {
        toolCalls: [
          { id: 'call_delete_1', name: 'delete_file', arguments: { path: 'old.txt' } },
          { id: 'call_rename_1', name: 'rename_file', arguments: { from: 'new.txt', to: 'final.txt' } },
        ],
      },
    );
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'I deleted old.txt and renamed new.txt.' });
  };

  it('surfaces every approval in the step before any is answered (#30152)', async () => {
    const executed: string[] = [];
    const executedAtDecision: string[][] = [];
    const { output, approvals, approvalBatches, requests } = await runApprovalScenario({
      llm: getMock(),
      engine,
      prompt: 'Delete old.txt and rename new.txt to final.txt.',
      tools: makeTools(true, executed),
      stopWhen: stepCountIs(5),
      decision: () => {
        executedAtDecision.push([...executed]);
        return true;
      },
      requireToolApproval: false,
      fixtures: deleteAndRename,
    });

    expect(approvalBatches[0]).toEqual(['call_delete_1', 'call_rename_1']);
    expect(approvals).toEqual(['approve:call_delete_1', 'approve:call_rename_1']);
    // Nothing ran before the first answer; the first approved call ran before the second answer.
    expect(executedAtDecision).toEqual([[], ['delete_file']]);
    expect(executed).toEqual(['delete_file', 'rename_file']);
    expect(requests.length).toBeGreaterThanOrEqual(2);
    expect(await output.text).toBeTruthy();
  });

  for (const [label, requireToolApproval] of [
    ['true', true],
    ['a function', ({ toolName }: { toolName: string }) => toolName !== 'read_file'],
  ] as const) {
    it(`surfaces every approval at once under run-wide requireToolApproval: ${label} (#30152)`, async () => {
      const executed: string[] = [];
      const { output, approvals, approvalBatches } = await runApprovalScenario({
        llm: getMock(),
        engine,
        prompt: 'Delete old.txt and rename new.txt to final.txt.',
        tools: makeTools(false, executed),
        stopWhen: stepCountIs(5),
        decision: () => true,
        requireToolApproval,
        fixtures: deleteAndRename,
      });

      expect(approvalBatches[0]).toEqual(['call_delete_1', 'call_rename_1']);
      expect(approvals).toEqual(['approve:call_delete_1', 'approve:call_rename_1']);
      expect(executed).toEqual(['delete_file', 'rename_file']);
      expect(await output.text).toBeTruthy();
    });
  }

  it('runs ungated calls right away and only the approved gated calls after answers', async () => {
    const executed: string[] = [];
    const executedAtDecision: string[][] = [];
    const { output, approvals, approvalBatches } = await runApprovalScenario({
      llm: getMock(),
      engine,
      prompt: 'Read config.yaml, delete old.txt, and rename new.txt.',
      tools: makeTools(true, executed),
      stopWhen: stepCountIs(5),
      decision: ({ toolCallId }) => {
        executedAtDecision.push([...executed]);
        return toolCallId.includes('rename');
      },
      requireToolApproval: false,
      fixtures: llm => {
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
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          { content: 'Read config.yaml, renamed new.txt but could not delete old.txt.' },
        );
      },
    });

    expect(approvalBatches[0]).toEqual(['call_delete_1', 'call_rename_1']);
    expect(approvals).toEqual(['decline:call_delete_1', 'approve:call_rename_1']);
    expect(executedAtDecision[0]).toEqual(['read_file']);
    expect(executed).toEqual(['read_file', 'rename_file']);
    expect(await output.text).toBeTruthy();
  });

  it('three concurrent approval-gated tool calls all surface at once', async () => {
    const executed: string[] = [];
    const tools = {
      ...makeTools(true, executed),
      archive_file: createTool({
        id: 'archive_file',
        description: 'Archive a file.',
        inputSchema: z.object({ path: z.string() }),
        outputSchema: z.object({ archived: z.boolean() }),
        requireApproval: true,
        execute: async () => {
          executed.push('archive_file');
          return { archived: true };
        },
      }),
    };

    const { output, approvals, approvalBatches } = await runApprovalScenario({
      llm: getMock(),
      engine,
      prompt: 'Delete old.txt, rename new.txt, and archive data.csv.',
      tools,
      stopWhen: stepCountIs(6),
      decision: () => true,
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

    expect(approvalBatches[0]).toEqual(['call_delete', 'call_rename', 'call_archive']);
    expect(approvals).toEqual(['approve:call_delete', 'approve:call_rename', 'approve:call_archive']);
    expect(executed).toEqual(['delete_file', 'rename_file', 'archive_file']);
    expect(await output.text).toBeTruthy();
  });
});
