import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * When a tool calls `suspend()` mid-run, the turn so far is flushed to memory
 * before the run pauses: the thread exists, and the user message plus every
 * tool call of the run (including the one that suspended) can be recalled.
 *
 * Replaces the hash-matched `tool-suspension.e2e` recording.
 */
describeForAllEngines('AIMock loop scenario: tool suspension persistence', engine => {
  const getMock = useLoopScenarioAimock();

  it('saves the thread, user message and both tool calls before suspend() returns', async () => {
    // suspend() runs the pre-suspension flush before it returns; wait on that, not a timer.
    let suspendReturned!: () => void;
    const suspendSettled = new Promise<void>(resolve => (suspendReturned = resolve));

    const validateData = createTool({
      id: 'validate-data',
      description: 'Validates data format before processing',
      inputSchema: z.object({ data: z.string() }),
      execute: async ({ data }) => ({ valid: true, message: `Data "${data}" is valid` }),
    });
    const processData = createTool({
      id: 'process-data',
      description: 'Processes validated data and may require manual approval',
      inputSchema: z.object({ data: z.string() }),
      suspendSchema: z.object({ reason: z.string() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async (_input, context) => {
        const suspended = await context?.agent?.suspend?.({ reason: 'Waiting for manual approval' });
        suspendReturned();
        return suspended;
      },
    });

    const llm = getMock();
    llm.on(
      { endpoint: 'chat', sequenceIndex: 0 },
      { toolCalls: [{ id: 'call_validate_1', name: 'validateData', arguments: { data: 'test-data-123' } }] },
    );
    llm.on(
      { endpoint: 'chat', sequenceIndex: 1 },
      { toolCalls: [{ id: 'call_process_1', name: 'processData', arguments: { data: 'test-data-123' } }] },
    );

    const memory = new MockMemory();
    const { agent } = await createSharedAgent(llm, { tools: { validateData, processData }, memory, engine });
    const threadId = `suspend-persist-${engine}`;
    const resourceId = 'user-suspend-persist';
    expect(await memory.getThreadById({ threadId })).toBeNull();

    // DurableAgent.stream() returns { fullStream, cleanup }; a regular agent returns the output itself.
    const result: any = await agent.stream('Please process the data "test-data-123". First validate it.', {
      memory: { thread: threadId, resource: resourceId },
      savePerStep: true,
      maxSteps: 10,
    });
    const chunkTypes: string[] = [];
    for await (const chunk of result.fullStream) {
      chunkTypes.push(chunk.type);
      if (chunk.type === 'tool-call-suspended') break;
    }
    await suspendSettled;
    result.cleanup?.();

    expect(chunkTypes).toContain('tool-call-suspended');
    expect((await memory.getThreadById({ threadId }))?.resourceId).toBe(resourceId);

    const { messages } = await memory.recall({ threadId, resourceId });
    const userText = messages
      .filter(m => m.role === 'user')
      .flatMap(m => m.content.parts)
      .flatMap(p => (p.type === 'text' ? [p.text] : []));
    expect(userText).toEqual(['Please process the data "test-data-123". First validate it.']);

    const savedToolCalls = messages
      .filter(m => m.role === 'assistant')
      .flatMap(m => m.content.parts)
      .flatMap(p => (p.type === 'tool-invocation' ? [p.toolInvocation.toolCallId] : []));
    expect(savedToolCalls).toEqual(['call_validate_1', 'call_process_1']);
  });

  it('publishes tool-call-suspended only after the parked tool call is persisted', async () => {
    // A consumer that reacts to the suspension chunk (a resume, or an abort that must
    // settle the parked call) has to find the message in memory already. Emitting the
    // chunk before the pre-suspension flush leaves that call still in flight (#1932).
    const processData = createTool({
      id: 'process-data',
      description: 'Processes validated data and may require manual approval',
      inputSchema: z.object({ data: z.string() }),
      suspendSchema: z.object({ reason: z.string() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async (_input, context) => {
        return await context?.agent?.suspend?.({ reason: 'Waiting for manual approval' });
      },
    });

    const llm = getMock();
    llm.on(
      { endpoint: 'chat', sequenceIndex: 0 },
      { toolCalls: [{ id: 'call_process_1', name: 'processData', arguments: { data: 'test-data-123' } }] },
    );

    const memory = new MockMemory();
    const { agent } = await createSharedAgent(llm, { tools: { processData }, memory, engine });
    const threadId = `suspend-emit-order-${engine}`;
    const resourceId = 'user-suspend-emit-order';

    const result: any = await agent.stream('Please process the data "test-data-123".', {
      memory: { thread: threadId, resource: resourceId },
      savePerStep: true,
      maxSteps: 10,
    });

    const toolCallsAtSuspension: string[] = [];
    for await (const chunk of result.fullStream) {
      if (chunk.type !== 'tool-call-suspended') continue;
      // Read memory the instant the suspension chunk arrives, with no await on suspend().
      const { messages } = await memory.recall({ threadId, resourceId });
      for (const message of messages) {
        for (const part of message.content.parts ?? []) {
          if (part.type === 'tool-invocation') toolCallsAtSuspension.push(part.toolInvocation.toolCallId);
        }
      }
      break;
    }
    result.cleanup?.();

    expect(toolCallsAtSuspension).toEqual(['call_process_1']);
  });

  it('publishes tool-call-approval only after the parked call is persisted (stream approval gate)', async () => {
    // Same guarantee as the suspension chunk above, for the approval gate: a client that
    // approves or aborts on `tool-call-approval` must find the parked call and its approval
    // metadata in memory already.
    const lookupStatus = createTool({
      id: 'lookup-status',
      description: 'Looks up a status',
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => ({ status: `OK:${query}` }),
    });

    const llm = getMock();
    llm.on(
      { endpoint: 'chat', sequenceIndex: 0 },
      { toolCalls: [{ id: 'call_lookup_1', name: 'lookupStatus', arguments: { query: 'alpha' } }] },
    );

    const memory = new MockMemory();
    const { agent } = await createSharedAgent(llm, { tools: { lookupStatus }, memory, engine });
    const threadId = `approval-gate-order-${engine}`;
    const resourceId = 'user-approval-gate-order';

    const result: any = await agent.stream('Look up alpha.', {
      memory: { thread: threadId, resource: resourceId },
      requireToolApproval: true,
      maxSteps: 10,
    });

    const stateAtApproval: { toolCalls: string[]; pending: string[] } = { toolCalls: [], pending: [] };
    for await (const chunk of result.fullStream) {
      if (chunk.type !== 'tool-call-approval') continue;
      // Read memory the instant the approval chunk arrives, with no await on the suspension.
      const { messages } = await memory.recall({ threadId, resourceId });
      for (const message of messages) {
        for (const part of message.content.parts ?? []) {
          if (part.type === 'tool-invocation') stateAtApproval.toolCalls.push(part.toolInvocation.toolCallId);
        }
        const pending = (message.content.metadata as any)?.pendingToolApprovals;
        if (pending) stateAtApproval.pending.push(...Object.keys(pending));
      }
      break;
    }
    result.cleanup?.();

    expect(stateAtApproval.toolCalls).toEqual(['call_lookup_1']);
    expect(stateAtApproval.pending).toEqual(['call_lookup_1']);
  });

  it('publishes tool-call-approval only after the parked call is persisted (runtime requireToolApproval)', async () => {
    // The tool asks for approval itself through `suspend(..., { requireToolApproval })`,
    // which reaches the same publication path from a different entry point.
    const confirmDelete = createTool({
      id: 'confirm-delete',
      description: 'Deletes a file after confirming with the user',
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }, context) => {
        await context?.agent?.suspend?.(
          { reason: 'Confirm deletion' },
          { requireToolApproval: { toolName: 'confirmDelete', args: { path } } },
        );
        return { deleted: true };
      },
    });

    const llm = getMock();
    llm.on(
      { endpoint: 'chat', sequenceIndex: 0 },
      { toolCalls: [{ id: 'call_delete_1', name: 'confirmDelete', arguments: { path: 'a.txt' } }] },
    );

    const memory = new MockMemory();
    const { agent } = await createSharedAgent(llm, { tools: { confirmDelete }, memory, engine });
    const threadId = `approval-runtime-order-${engine}`;
    const resourceId = 'user-approval-runtime-order';

    const result: any = await agent.stream('Delete a.txt.', {
      memory: { thread: threadId, resource: resourceId },
      maxSteps: 10,
    });

    const stateAtApproval: { toolCalls: string[]; pending: string[] } = { toolCalls: [], pending: [] };
    for await (const chunk of result.fullStream) {
      if (chunk.type !== 'tool-call-approval') continue;
      const { messages } = await memory.recall({ threadId, resourceId });
      for (const message of messages) {
        for (const part of message.content.parts ?? []) {
          if (part.type === 'tool-invocation') stateAtApproval.toolCalls.push(part.toolInvocation.toolCallId);
        }
        const pending = (message.content.metadata as any)?.pendingToolApprovals;
        if (pending) stateAtApproval.pending.push(...Object.keys(pending));
      }
      break;
    }
    result.cleanup?.();

    expect(stateAtApproval.toolCalls).toEqual(['call_delete_1']);
    expect(stateAtApproval.pending).toEqual(['call_delete_1']);
  });
});
