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
});
