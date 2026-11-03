import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { MastraDBMessage } from '../../../../agent/message-list';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  runLoopScenario,
  useLoopScenarioAimock,
} from '../aimock-scenario';

/**
 * Regression class: completed steps are historical facts in the memory thread.
 *
 * - With savePerStep, the saved tool result is the raw value the tool returned;
 *   what `toModelOutput` sent to the model is kept separately in
 *   `providerMetadata.mastra.modelOutput`.
 * - Cancelling the reply that follows a tool call must not erase the tool call
 *   and its result: the tool may already have done something irreversible.
 */

const RAW_RESULT = { output: 'hello', nested: { raw: true }, rows: [{ id: 1, value: 'x' }] };
const MODEL_OUTPUT = { type: 'text' as const, value: 'Echoed hello' };
const SLOW_REPLY = 'The echo tool answered, and here is a long explanation the user cancels.';

function toolInvocations(messages: MastraDBMessage[]) {
  return messages
    .flatMap(message => message.content.parts ?? [])
    .filter(part => part.type === 'tool-invocation')
    .map(part => part as Extract<MastraDBMessage['content']['parts'][number], { type: 'tool-invocation' }>);
}

describeForAllEngines('AIMock loop scenario: persistence of completed steps', engine => {
  const getMock = useLoopScenarioAimock();

  it('savePerStep saves the raw tool result and keeps the model-facing output in metadata', async () => {
    const memory = new MockMemory();
    const threadId = `save-per-step-model-output-${engine}`;
    const resourceId = 'customer-echo';
    const echo = createTool({
      id: 'echo',
      description: 'Echoes the input',
      inputSchema: z.object({ input: z.string() }),
      execute: async () => RAW_RESULT,
      toModelOutput: () => MODEL_OUTPUT,
    });

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Echo hello.',
      tools: { echo },
      memory,
      threadId,
      resourceId,
      savePerStep: true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          { toolCalls: [{ id: 'call_echo', name: 'echo', arguments: { input: 'hello' } }] },
        );
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Response after tool' });
      },
    });

    expect(await output.text).toBe('Response after tool');
    expect(requests).toHaveLength(2);
    // The model saw the toModelOutput value, not the raw result.
    const toolMessage = requests[1]!.body?.messages.find((m: { role: string }) => m.role === 'tool');
    expect(JSON.stringify(toolMessage)).toContain('Echoed hello');
    expect(JSON.stringify(toolMessage)).not.toContain('"rows"');

    await expect
      .poll(async () => toolInvocations((await memory.recall({ threadId, resourceId })).messages))
      .toHaveLength(1);
    const { messages } = await memory.recall({ threadId, resourceId });
    const [invocation] = toolInvocations(messages);
    expect(invocation!.toolInvocation).toMatchObject({ toolCallId: 'call_echo', state: 'result', result: RAW_RESULT });
    expect(invocation!.providerMetadata?.mastra?.modelOutput).toEqual(MODEL_OUTPUT);
    expect(
      messages
        .flatMap(message => message.content.parts ?? [])
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join(''),
    ).toContain('Response after tool');
  });

  it('a tool that throws is saved as a completed tool step, not as a failed turn', async () => {
    const memory = new MockMemory();
    const threadId = `failing-tool-${engine}`;
    const resourceId = 'customer-failing-tool';
    const onErrorCalls: unknown[] = [];
    const failingTool = createTool({
      id: 'failingTool',
      description: 'Always fails',
      inputSchema: z.object({}),
      execute: async () => {
        throw new Error('TOOL_EXECUTION_FAILED');
      },
    });

    const { output, requests, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Use the tool.',
      tools: { failingTool },
      memory,
      threadId,
      resourceId,
      collectChunks: true,
      onError: ({ error }) => {
        onErrorCalls.push(error);
      },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          { toolCalls: [{ id: 'call_fail', name: 'failingTool', arguments: {} }] },
        );
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'The tool failed, sorry.' });
      },
    });

    expect(await output.text).toBe('The tool failed, sorry.');
    expect(JSON.stringify(requests[1]!.body?.messages)).toContain('TOOL_EXECUTION_FAILED');
    expect(chunks!.filter(c => c.type === 'error')).toEqual([]);
    expect(onErrorCalls).toEqual([]);

    await expect
      .poll(async () => toolInvocations((await memory.recall({ threadId, resourceId })).messages))
      .toHaveLength(1);
    const { messages } = await memory.recall({ threadId, resourceId });
    expect(toolInvocations(messages)[0]!.toolInvocation).toMatchObject({
      toolCallId: 'call_fail',
      state: 'output-error',
    });
    expect(JSON.stringify(toolInvocations(messages)[0]!.toolInvocation)).toContain('TOOL_EXECUTION_FAILED');
    expect(messages.flatMap(message => message.content.parts ?? []).some(part => part.type === 'error')).toBe(false);
  });

  for (const savePerStep of [false, true]) {
    it(`cancelling the reply after a tool call keeps the tool call and result (savePerStep: ${savePerStep})`, async () => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', sequenceIndex: 0 },
        { toolCalls: [{ id: 'call_echo', name: 'echo', arguments: { input: 'hello' } }] },
      );
      llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: SLOW_REPLY }, { chunkSize: 4, latency: 30 });
      let toolRuns = 0;
      const echo = createTool({
        id: 'echo',
        description: 'Echoes the input',
        inputSchema: z.object({ input: z.string() }),
        execute: async ({ input }) => {
          toolRuns += 1;
          return { output: input };
        },
      });
      const memory = new MockMemory();
      const { agent } = await createSharedAgent(llm, { engine, memory, tools: { echo } });
      const threadId = `abort-after-tool-${engine}-${savePerStep}`;
      const resourceId = 'customer-abort-after-tool';

      const controller = new AbortController();
      const result = await agent.stream('Echo hello, then explain.', {
        memory: { thread: threadId, resource: resourceId },
        abortSignal: controller.signal,
        savePerStep,
      });
      const output = isDurableEngineVariant(engine) ? (result as unknown as { output: typeof result }).output : result;
      let sawToolResult = false;
      let streamedAfterTool = '';
      try {
        for await (const chunk of output.fullStream) {
          if (chunk.type === 'tool-result') sawToolResult = true;
          if (chunk.type === 'text-delta' && sawToolResult) {
            streamedAfterTool += chunk.payload.text;
            controller.abort();
          }
        }
      } catch {
        // Durable streams can reject with AbortError after the abort chunk.
      }

      // Guard: the abort landed during the reply that followed the tool step.
      expect(toolRuns).toBe(1);
      expect(streamedAfterTool.length).toBeGreaterThan(0);
      expect(streamedAfterTool.length).toBeLessThan(SLOW_REPLY.length);
      expect(llm.getRequests()).toHaveLength(2);

      await expect
        .poll(async () => toolInvocations((await memory.recall({ threadId, resourceId })).messages))
        .toHaveLength(1);
      const { messages } = await memory.recall({ threadId, resourceId });
      expect(messages[0]!.role).toBe('user');
      expect(toolInvocations(messages)[0]!.toolInvocation).toMatchObject({
        toolCallId: 'call_echo',
        toolName: 'echo',
        state: 'result',
        args: { input: 'hello' },
        result: { output: 'hello' },
      });
      expect(messages.flatMap(message => message.content.parts ?? []).some(part => part.type === 'error')).toBe(false);
    });
  }
});
