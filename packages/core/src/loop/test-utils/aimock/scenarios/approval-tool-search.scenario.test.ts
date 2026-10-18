import { it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import { ToolSearchProcessor } from '../../../../processors';
import { ProcessorStepInputSchema, ProcessorStepOutputSchema } from '../../../../processors/step-schema';
import type { ChunkType } from '../../../../stream/types';
import { createTool } from '../../../../tools';
import { createStep, createWorkflow } from '../../../../workflows';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';
import { isDurableEngineVariant } from '../types';
import type { RunLoopScenarioOptions } from '../types';

type RunHandle = { fullStream: AsyncIterable<ChunkType>; runId: string };
type InputProcessors = NonNullable<RunLoopScenarioOptions['inputProcessors']>;

/**
 * Drain a run's stream. Durable streams stay open while suspended, so stop at the approval chunk.
 */
async function drain(run: RunHandle, durable: boolean): Promise<ChunkType[]> {
  const chunks: ChunkType[] = [];
  for await (const chunk of run.fullStream) {
    chunks.push(chunk);
    if (durable && chunk.type === 'tool-call-approval') break;
  }
  return chunks;
}

/**
 * Regression class: approval on a tool that only exists because ToolSearchProcessor loaded it.
 *
 * The model calls `load_tool`, then calls the freshly loaded tool, which requires approval.
 * After approval the resumed run must still know the dynamically loaded tool and execute it,
 * whether the processor is attached directly, inside a processor workflow, or inside a
 * workflow nested in another workflow.
 */
describeForAllEngines('AIMock loop scenario: approval on a tool loaded by ToolSearchProcessor', engine => {
  const getMock = useLoopScenarioAimock();

  const expectLoadedToolRunsAfterApproval = async (
    toolId: string,
    buildProcessors: (toolSearch: ToolSearchProcessor) => InputProcessors,
  ) => {
    const execute = vi.fn(async ({ value }: { value: string }) => ({ ok: true, value }));
    const approvalTool = createTool({
      id: toolId,
      description: 'Runs an action that requires approval',
      inputSchema: z.object({ value: z.string() }),
      requireApproval: true,
      execute,
    });
    const toolSearch = new ToolSearchProcessor({ tools: { [toolId]: approvalTool } });

    const shared = await createSharedAgent(getMock(), {
      engine,
      instructions: 'Load and use dynamic tools.',
      inputProcessors: buildProcessors(toolSearch),
    });

    getMock().on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call_load', name: 'load_tool', arguments: { toolName: toolId } }] },
    );
    getMock().on(
      { endpoint: 'chat', toolCallId: 'call_load', hasToolResult: true },
      { toolCalls: [{ id: 'call_dynamic', name: toolId, arguments: { value: 'approved input' } }] },
    );
    getMock().on({ endpoint: 'chat', toolCallId: 'call_dynamic', hasToolResult: true }, { content: 'Done.' });
    const durable = isDurableEngineVariant(engine);

    const run = (await shared.agent.stream('Load and use the approval tool', { maxSteps: 5 })) as RunHandle;
    const firstChunks = await drain(run, durable);

    const approval = firstChunks.find(chunk => chunk.type === 'tool-call-approval');
    expect((approval?.payload as { toolCallId?: string } | undefined)?.toolCallId).toBe('call_dynamic');
    expect(execute).not.toHaveBeenCalled();

    const resumed = await drain(
      await shared.agent.approveToolCall({ runId: run.runId, toolCallId: 'call_dynamic' }),
      false,
    );

    expect(resumed.filter(chunk => chunk.type === 'tool-error')).toEqual([]);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]?.[0]).toEqual({ value: 'approved input' });
  };

  it('runs a tool loaded by ToolSearchProcessor after it is approved', async () => {
    await expectLoadedToolRunsAfterApproval('dynamic_approval_tool', toolSearch => [toolSearch]);
  });

  it('runs a tool loaded by a ToolSearchProcessor inside a processor workflow after it is approved', async () => {
    await expectLoadedToolRunsAfterApproval('dynamic_workflow_approval_tool', toolSearch => [
      createWorkflow({
        id: 'tool-search-approval-processor-workflow',
        inputSchema: ProcessorStepInputSchema,
        outputSchema: ProcessorStepOutputSchema,
      })
        .then(createStep(toolSearch))
        .commit(),
    ]);
  });

  it('runs a tool loaded by a ToolSearchProcessor inside a nested processor workflow after it is approved', async () => {
    await expectLoadedToolRunsAfterApproval('dynamic_nested_workflow_approval_tool', toolSearch => {
      const inner = createWorkflow({
        id: 'inner-tool-search-approval-processor-workflow',
        inputSchema: ProcessorStepInputSchema,
        outputSchema: ProcessorStepOutputSchema,
      })
        .then(createStep(toolSearch))
        .commit();
      return [
        createWorkflow({
          id: 'parent-tool-search-approval-processor-workflow',
          inputSchema: ProcessorStepInputSchema,
          outputSchema: ProcessorStepOutputSchema,
        })
          .then(createStep(inner as any))
          .commit(),
      ];
    });
  });
});
