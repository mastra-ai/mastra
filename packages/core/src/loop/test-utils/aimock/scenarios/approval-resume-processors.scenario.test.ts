import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { TripWire } from '../../../../agent/trip-wire';
import { MockMemory } from '../../../../memory';
import { ToolSearchProcessor } from '../../../../processors';
import type { ProcessInputStepArgs, Processor } from '../../../../processors';
import { ProcessorStepInputSchema, ProcessorStepOutputSchema } from '../../../../processors/step-schema';
import { createTool } from '../../../../tools';
import { createStep, createWorkflow } from '../../../../workflows';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: input processors on an approval or suspension resume.
 *
 * A resumed run rebuilds its processors and tools from the agent, not from the
 * call that suspended. Processors that guard against an empty conversation must
 * still see the restored history, and tools a processor loaded dynamically
 * before the pause must still be executable after it.
 */
describeForAllEngines('AIMock loop scenario: input processors across an approval resume', engine => {
  const getMock = useLoopScenarioAimock();

  // Aborts when the message list is empty, like TokenLimiterProcessor does. A resume that
  // dropped the restored history would trip it.
  class RequiresHistory implements Processor<'requires-history'> {
    readonly id = 'requires-history';
    processInput({ messages, messageList, abort }: any) {
      if (messageList.get.all.db().length === 0) abort('No messages to send to the model.');
      return messages;
    }
    processInputStep({ messageList }: ProcessInputStepArgs) {
      if (messageList.get.all.db().length === 0) {
        throw new TripWire('No messages to send to the model.', { retry: false });
      }
    }
  }

  const lookupFixtures = (llm: ReturnType<typeof getMock>) => {
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call-find', name: 'findUser', arguments: { name: 'Dero Israel' } }] },
    );
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'User found: Dero Israel.' });
  };

  it('approving a tool call does not trip a history-checking input processor', async () => {
    const execute = vi.fn(async ({ name }: { name: string }) => ({ name, email: 'dero@mail.com' }));
    const findUser = createTool({
      id: 'findUser',
      description: 'Find a user by name.',
      inputSchema: z.object({ name: z.string() }),
      requireApproval: true,
      execute,
    });
    const shared = await createSharedAgent(getMock(), {
      engine,
      tools: { findUser },
      inputProcessors: [new RequiresHistory()],
    });

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'Find the user named Dero Israel.',
      stopWhen: stepCountIs(5),
      collectChunks: true,
      fixtures: lookupFixtures,
    });
    const approval = chunks!.find(c => c.type === 'tool-call-approval') as any;
    expect(approval).toBeDefined();

    const resumed = await shared.agent.approveToolCall({
      runId: output.runId,
      toolCallId: approval.payload.toolCallId,
    });
    const types: string[] = [];
    for await (const chunk of resumed.fullStream) types.push(chunk.type);

    expect(types).not.toContain('tripwire');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(await resumed.text).toBe('User found: Dero Israel.');
  });

  it('resuming a suspended tool does not trip a history-checking input processor', async () => {
    const findUser = createTool({
      id: 'findUser',
      description: 'Find a user by name.',
      inputSchema: z.object({ name: z.string() }),
      suspendSchema: z.object({ message: z.string() }),
      resumeSchema: z.object({ name: z.string() }),
      execute: async (_input, context) => {
        if (!context?.agent?.resumeData) return await context?.agent?.suspend({ message: 'Which user?' });
        return { name: context.agent.resumeData.name, email: 'dero@mail.com' };
      },
    });
    const shared = await createSharedAgent(getMock(), {
      engine,
      tools: { findUser },
      inputProcessors: [new RequiresHistory()],
    });

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'Find the user named Dero Israel.',
      stopWhen: stepCountIs(5),
      collectChunks: true,
      fixtures: lookupFixtures,
    });
    expect(chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);

    const resumed = await shared.agent.resumeStream({ name: 'Dero Israel' }, { runId: output.runId });
    const types: string[] = [];
    for await (const chunk of resumed.fullStream) types.push(chunk.type);

    expect(types).not.toContain('tripwire');
    expect(await resumed.text).toBe('User found: Dero Israel.');
  });

  // Technical: ToolSearchProcessor adds `load_tool`; the tool it loads exists only in processor
  // state. After the approval pause the resumed run must rebuild it, whether the processor runs
  // directly, inside a processor workflow, or inside a workflow nested with createStep.
  const toolSearchSetups: Array<{ label: string; wrap: (processor: ToolSearchProcessor) => any }> = [
    { label: 'directly', wrap: processor => processor },
    {
      label: 'from a processor workflow',
      wrap: processor =>
        createWorkflow({
          id: 'tool-search-workflow',
          inputSchema: ProcessorStepInputSchema,
          outputSchema: ProcessorStepOutputSchema,
        })
          .then(createStep(processor))
          .commit(),
    },
    {
      label: 'from a nested processor workflow',
      wrap: processor => {
        const inner = createWorkflow({
          id: 'inner-tool-search-workflow',
          inputSchema: ProcessorStepInputSchema,
          outputSchema: ProcessorStepOutputSchema,
        })
          .then(createStep(processor))
          .commit();
        return createWorkflow({
          id: 'outer-tool-search-workflow',
          inputSchema: ProcessorStepInputSchema,
          outputSchema: ProcessorStepOutputSchema,
        })
          .then(createStep(inner as any))
          .commit();
      },
    },
  ];
  for (const { label, wrap } of toolSearchSetups) {
    it(`runs a tool loaded by ToolSearchProcessor ${label} after approval`, async () => {
      const execute = vi.fn(async () => ({ ok: true }));
      const archiveOrder = createTool({
        id: 'archive_order',
        description: 'Archive an order. Needs approval.',
        inputSchema: z.object({ orderId: z.string() }),
        requireApproval: true,
        execute,
      });
      const memory = new MockMemory();
      const shared = await createSharedAgent(getMock(), {
        engine,
        memory,
        inputProcessors: [wrap(new ToolSearchProcessor({ tools: { archive_order: archiveOrder } }))],
      });

      const { output, chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'Archive order 4821.',
        memory,
        threadId: `thread-tool-search-${label}`,
        resourceId: 'user-1',
        stopWhen: stepCountIs(5),
        collectChunks: true,
        fixtures: llm => {
          llm.on({ endpoint: 'chat', toolCallId: 'call-archive', hasToolResult: true }, { content: 'Archived.' });
          llm.on(
            { endpoint: 'chat', toolCallId: 'call-load', hasToolResult: true },
            { toolCalls: [{ id: 'call-archive', name: 'archive_order', arguments: { orderId: '4821' } }] },
          );
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call-load', name: 'load_tool', arguments: { toolName: 'archive_order' } }] },
          );
        },
      });
      const approval = chunks!.find(c => c.type === 'tool-call-approval') as any;
      expect(approval?.payload.toolCallId).toBe('call-archive');

      const resumed = await shared.agent.approveToolCall({ runId: output.runId, toolCallId: 'call-archive' });
      const toolErrors: unknown[] = [];
      for await (const chunk of resumed.fullStream) {
        if (chunk.type === 'tool-error') toolErrors.push(chunk.payload);
      }

      expect(toolErrors).toEqual([]);
      expect(execute).toHaveBeenCalledWith({ orderId: '4821' }, expect.anything());
      expect(await resumed.text).toBe('Archived.');
    });
  }
});
