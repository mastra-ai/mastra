import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory';
import { ToolCallFilter } from '../../../../processors/processors/tool-call-filter';
import { createTool } from '../../../../tools';
import { createSharedAgent, runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * ToolCallFilter + resumeStream() (issue #24382).
 *
 * Without `filterAfterToolSteps`, the filter only strips tool calls from prior
 * history and keeps the current run's tool calls. A resumed run starts a fresh
 * loop, so its first LLM request already contains the run's own suspended tool
 * call plus the freshly resolved result. Those belong to the current run and
 * must survive filtering, otherwise the model never sees its question or the
 * user's answer and asks again.
 *
 * The filter identifies the current run's tool calls from the loop's `steps`.
 * Durable and evented engines pass reduced step records without `content`, so
 * every scenario runs across all engines.
 *
 * Regression classes:
 * - Resumed LLM request keeps the suspended tool call and its result
 * - Resumed run completes instead of suspending again
 * - Earlier tool calls from the same run also survive the resume
 * - Tool calls from earlier steps of the same run survive later steps
 * - Tool calls from a previous turn are still filtered
 */
describeForAllEngines('AIMock loop scenario: ToolCallFilter with resumeStream()', engine => {
  const getMock = useLoopScenarioAimock();

  const lookup = createTool({
    id: 'lookup',
    description: 'Looks up a value',
    inputSchema: z.object({ q: z.string() }),
    execute: async ({ q }) => ({ result: `found ${q}` }),
  });

  // Durable engines read input processors from the agent constructor, the others from defaultOptions.
  const createFilteredAgent = (tools: Record<string, any>, memory: MockMemory) =>
    createSharedAgent(getMock(), {
      tools,
      memory,
      engine,
      inputProcessors: [new ToolCallFilter()],
      defaultOptions: { inputProcessors: [new ToolCallFilter()] },
    });

  const hasToolCall = (messages: any[], id: string) =>
    messages.some(m => m.role === 'assistant' && m.tool_calls?.some((tc: any) => tc.id === id));
  const hasToolResult = (messages: any[], id: string) => messages.some(m => m.role === 'tool' && m.tool_call_id === id);

  it("keeps the resumed run's suspended tool call and result in the resumed LLM request", async () => {
    const askLanguage = createTool({
      id: 'ask-language',
      description: 'Asks the user which language they want',
      inputSchema: z.object({ question: z.string() }),
      suspendSchema: z.object({ question: z.string() }),
      resumeSchema: z.object({ answer: z.string() }),
      execute: async (input, context) => {
        if (!context?.agent?.resumeData) {
          return await context?.agent?.suspend({ question: input.question });
        }
        return { answer: context.agent.resumeData.answer };
      },
    });

    const memory = new MockMemory();
    const shared = await createFilteredAgent({ lookup, askLanguage }, memory);

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'Ask me which language I want, then write hello world in it.',
      memory,
      threadId: 'thread-tool-call-filter-resume',
      resourceId: 'resource-tool-call-filter-resume',
      fixtures: llm => {
        // Only matches when the request carries the resolved tool result for call-1.
        llm.onToolResult('call-1', { content: 'console.log("hello world")' });
        // A completed tool call earlier in the same run, before the suspension.
        llm.onToolResult('call-0', {
          toolCalls: [{ id: 'call-1', name: 'ask-language', arguments: { question: 'Which language?' } }],
        });
        llm.onMessage(/language/i, {
          toolCalls: [{ id: 'call-0', name: 'lookup', arguments: { q: 'languages' } }],
        });
      },
      collectChunks: true,
    });

    expect(chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);

    const requestsBeforeResume = getMock().getRequests().length;

    const resumed = await shared.agent.resumeStream({ answer: 'TypeScript' }, { runId: output.runId });
    const resumedChunks: any[] = [];
    for await (const chunk of resumed.fullStream) resumedChunks.push(chunk);

    const resumedRequest = getMock().getRequests()[requestsBeforeResume] as any;
    const messages = resumedRequest.body.messages as any[];

    expect(hasToolCall(messages, 'call-0')).toBe(true);
    expect(hasToolResult(messages, 'call-0')).toBe(true);
    expect(hasToolCall(messages, 'call-1')).toBe(true);
    const toolResult = messages.find(m => m.role === 'tool' && m.tool_call_id === 'call-1');
    expect(JSON.stringify(toolResult?.content)).toContain('TypeScript');

    expect(resumedChunks.some(c => c.type === 'tool-call-suspended')).toBe(false);
    expect(await resumed.text).toContain('hello world');
  });

  it('keeps tool calls from earlier steps of the same run', async () => {
    const memory = new MockMemory();
    const shared = await createFilteredAgent({ lookup }, memory);

    await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'Look up two things.',
      memory,
      threadId: 'thread-tool-call-filter-steps',
      resourceId: 'resource-tool-call-filter-steps',
      fixtures: llm => {
        llm.onToolResult('call-2', { content: 'done' });
        llm.onToolResult('call-1', { toolCalls: [{ id: 'call-2', name: 'lookup', arguments: { q: 'b' } }] });
        llm.onMessage(/two things/i, { toolCalls: [{ id: 'call-1', name: 'lookup', arguments: { q: 'a' } }] });
      },
    });

    // Without the current run's tool calls the model repeats them, so an extra request means they were filtered.
    const requests = getMock().getRequests() as any[];
    expect(requests).toHaveLength(3);
    const lastMessages = requests[2].body.messages as any[];
    for (const id of ['call-1', 'call-2']) {
      expect(hasToolCall(lastMessages, id)).toBe(true);
      expect(hasToolResult(lastMessages, id)).toBe(true);
    }
  });

  it('still filters tool calls from a previous turn', async () => {
    const memory = new MockMemory();
    const shared = await createFilteredAgent({ lookup }, memory);
    const turn = {
      engine,
      llm: getMock(),
      sharedAgent: shared,
      memory,
      threadId: 'thread-tool-call-filter-history',
      resourceId: 'resource-tool-call-filter-history',
      fixtures: (llm: any) => {
        llm.onToolResult('call-9', { content: 'second done' });
        llm.onToolResult('call-1', { content: 'first done' });
        llm.onMessage(/second turn/i, { toolCalls: [{ id: 'call-9', name: 'lookup', arguments: { q: 'z' } }] });
        llm.onMessage(/first turn/i, { toolCalls: [{ id: 'call-1', name: 'lookup', arguments: { q: 'a' } }] });
      },
    };

    await runLoopScenario({ ...turn, prompt: 'first turn' });
    const requestsBeforeSecondTurn = getMock().getRequests().length;
    await runLoopScenario({ ...turn, prompt: 'second turn' });

    const secondTurnRequests = (getMock().getRequests() as any[]).slice(requestsBeforeSecondTurn);
    expect(secondTurnRequests).toHaveLength(2);
    for (const request of secondTurnRequests) {
      expect(hasToolCall(request.body.messages, 'call-1')).toBe(false);
      expect(hasToolResult(request.body.messages, 'call-1')).toBe(false);
    }
    const lastMessages = secondTurnRequests[1].body.messages as any[];
    expect(hasToolCall(lastMessages, 'call-9')).toBe(true);
    expect(hasToolResult(lastMessages, 'call-9')).toBe(true);
  });
});
