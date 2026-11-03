/**
 * AIMock Scenario: a workspace data chunk written after a task-signal rotation
 * stays in the current response message (GRWTH-1915)
 *
 * Step 1 streams reasoning/text plus `task_write`. The task-state signal then
 * rotates the response message id for step 2, which runs a workspace tool that
 * emits `data-workspace-metadata`. That chunk must persist under the rotated
 * response message: if the tool writer falls back to the run-level id, it lands
 * on the sealed step-1 row and its earlier parts are lost.
 */

import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Memory } from '../../../../../../memory/src';
import { TaskSignalProvider } from '../../../../signals';
import { createTool } from '../../../../tools';
import { taskWriteTool } from '../../../../tools/builtin/task-tools';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

function toolInvocationOwner(messages: any[], toolCallId: string) {
  return messages.find(message =>
    (message.content?.parts ?? []).some(
      (part: any) => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === toolCallId,
    ),
  );
}

function hasWorkspaceMetadata(message: any) {
  return (message?.content?.parts ?? []).some((part: any) => part.type === 'data-workspace-metadata');
}

describeForAllEngines('AIMock scenario: workspace metadata after a task-signal rotation', engine => {
  const getMock = useLoopScenarioAimock();

  it('keeps the first step and stores the chunk in the rotated response message', async () => {
    const threadId = 'workspace-metadata-after-signal-thread';
    const resourceId = 'workspace-metadata-after-signal-user';

    const listFiles = createTool({
      id: 'list_files',
      description: 'Lists workspace files',
      inputSchema: z.object({}),
      execute: async (_input, context) => {
        await context?.writer?.custom({
          type: 'data-workspace-metadata',
          data: { toolName: 'list_files' },
        });
        return { files: ['README.md'] };
      },
    });

    const memory = new Memory({ options: { generateTitle: false } });
    const shared = await createSharedAgent(getMock(), {
      engine,
      tools: { task_write: taskWriteTool, list_files: listFiles },
      signals: [new TaskSignalProvider()],
      memory,
    });

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      memory,
      prompt: 'Plan the work, then inspect the workspace.',
      threadId,
      resourceId,
      maxSteps: 5,
      collectChunks: true,
      fixtures: mock => {
        mock.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          {
            content: 'Planning the work.',
            toolCalls: [
              {
                id: 'call_task_write',
                name: 'task_write',
                arguments: {
                  tasks: [
                    { id: 'inspect', content: 'Inspect the workspace', activeForm: 'Inspecting', status: 'pending' },
                  ],
                },
              },
            ],
          },
        );
        mock.on(
          { endpoint: 'chat', sequenceIndex: 1 },
          { toolCalls: [{ id: 'call_list_files', name: 'list_files', arguments: {} }] },
        );
        mock.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'The workspace has a README.' });
      },
    });

    expect(chunks?.filter(chunk => chunk.type === 'data-workspace-metadata')).toHaveLength(1);

    const { messages } = await memory.recall({ threadId, resourceId, hideSignals: false });

    // Step 1's sealed row keeps its text and completed task_write call.
    const taskOwner = toolInvocationOwner(messages, 'call_task_write');
    expect(taskOwner).toBeDefined();
    expect(hasWorkspaceMetadata(taskOwner)).toBe(false);
    expect(taskOwner!.content.parts).toContainEqual(
      expect.objectContaining({ type: 'text', text: 'Planning the work.' }),
    );
    expect(
      taskOwner!.content.parts.find(
        (part: any) => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === 'call_task_write',
      )!.toolInvocation.state,
    ).toBe('result');

    // The chunk lands in the rotated response message that owns the second tool call.
    const inspectOwner = toolInvocationOwner(messages, 'call_list_files');
    expect(inspectOwner).toBeDefined();
    expect(hasWorkspaceMetadata(inspectOwner)).toBe(true);
    expect(inspectOwner!.id).not.toBe(taskOwner!.id);
  });
});
