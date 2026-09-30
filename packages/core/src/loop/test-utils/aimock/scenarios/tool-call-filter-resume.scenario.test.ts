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
 * Regression classes:
 * - Resumed LLM request keeps the suspended tool call and its result
 * - Resumed run completes instead of suspending again
 * - Earlier tool calls from the same run also survive the resume
 */
describeForAllEngines('AIMock loop scenario: ToolCallFilter with resumeStream()', engine => {
  const getMock = useLoopScenarioAimock();

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

    const shared = await createSharedAgent(getMock(), {
      tools: { askLanguage },
      memory: new MockMemory(),
      engine,
      defaultOptions: { inputProcessors: [new ToolCallFilter()] },
    });

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'Ask me which language I want, then write hello world in it.',
      memory: new MockMemory(),
      threadId: 'thread-tool-call-filter-resume',
      resourceId: 'resource-tool-call-filter-resume',
      fixtures: llm => {
        // Only matches when the request carries the resolved tool result for call-1.
        llm.onToolResult('call-1', { content: 'console.log("hello world")' });
        llm.onMessage(/language/i, {
          toolCalls: [{ id: 'call-1', name: 'ask-language', arguments: { question: 'Which language?' } }],
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

    const assistantWithCall = messages.find(
      m => m.role === 'assistant' && m.tool_calls?.some((tc: any) => tc.id === 'call-1'),
    );
    const toolResult = messages.find(m => m.role === 'tool' && m.tool_call_id === 'call-1');
    expect(assistantWithCall).toBeDefined();
    expect(toolResult).toBeDefined();
    expect(JSON.stringify(toolResult.content)).toContain('TypeScript');

    expect(resumedChunks.some(c => c.type === 'tool-call-suspended')).toBe(false);
    expect(await resumed.text).toContain('hello world');
  });
});
