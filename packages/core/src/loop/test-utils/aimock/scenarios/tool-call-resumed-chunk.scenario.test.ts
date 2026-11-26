import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: the live `tool-call-resumed` ack (#24280).
 *
 * Resuming a suspended or approval-gated call emits one `tool-call-resumed`
 * chunk on the original toolCallId before its `tool-result`, so clients can
 * clear the pending prompt. Fresh calls never emit it, even when the model's
 * args happen to contain a `resumeData` key.
 */
describeForAllEngines('AIMock loop scenario: tool-call-resumed ack', engine => {
  const getMock = useLoopScenarioAimock();

  const askUser = createTool({
    id: 'askUser',
    description: 'Asks the user a question.',
    inputSchema: z.object({ question: z.string() }),
    suspendSchema: z.object({ question: z.string() }),
    resumeSchema: z.object({ answer: z.string() }),
    execute: async (input, context) => {
      if (!context?.agent?.resumeData) return await context?.agent?.suspend({ question: input.question });
      return { answer: context.agent.resumeData.answer };
    },
  });

  const doThing = createTool({
    id: 'doThing',
    description: 'Does a thing.',
    inputSchema: z.object({ value: z.string() }),
    requireApproval: true,
    execute: async input => ({ done: input.value }),
  });

  const callThenFinish = (llm: ReturnType<typeof getMock>, id: string, name: string, args: object) => {
    llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [{ id, name, arguments: args }] });
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'done' });
  };

  async function collect(stream: { fullStream: AsyncIterable<any> }) {
    const chunks: any[] = [];
    for await (const chunk of stream.fullStream) chunks.push(chunk);
    return chunks;
  }

  it('acks a resumed suspension before its tool-result', async () => {
    const shared = await createSharedAgent(getMock(), { engine, tools: { askUser } });
    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'ask',
      stopWhen: stepCountIs(3),
      collectChunks: true,
      fixtures: llm => callThenFinish(llm, 'tc-1', 'askUser', { question: 'color?' }),
    });
    expect(chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);
    expect(chunks!.some(c => c.type === 'tool-call-resumed')).toBe(false);

    const resumedStream = await shared.agent.resumeStream(
      { answer: 'blue' },
      { runId: output.runId, toolCallId: 'tc-1' },
    );
    const resumed = await collect(resumedStream);
    const acks = resumed.filter(c => c.type === 'tool-call-resumed');
    expect(acks).toHaveLength(1);
    expect(acks[0].payload).toMatchObject({
      toolCallId: 'tc-1',
      toolName: 'askUser',
      kind: 'suspension',
      suspendPayload: { question: 'color?' },
    });
    expect(acks[0].payload.resumeSchema).toEqual(expect.any(String));
    const resultIndex = resumed.findIndex(c => c.type === 'tool-result' && c.payload.toolCallId === 'tc-1');
    expect(resultIndex).toBeGreaterThan(resumed.indexOf(acks[0]));
    expect(resumed.some(c => c.type === 'tool-call-suspended')).toBe(false);
    expect(await resumedStream.toolCalls).toMatchObject([
      { payload: { toolCallId: 'tc-1', toolName: 'askUser', args: { question: 'color?' } } },
    ]);
  });

  it('acks an approved call before its tool-result', async () => {
    const shared = await createSharedAgent(getMock(), { engine, tools: { doThing } });
    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'go',
      stopWhen: stepCountIs(3),
      collectChunks: true,
      fixtures: llm => callThenFinish(llm, 'tc-appr', 'doThing', { value: 'x' }),
    });
    expect(chunks!.some(c => c.type === 'tool-call-approval')).toBe(true);

    const resumed = await collect(await shared.agent.approveToolCall({ runId: output.runId, toolCallId: 'tc-appr' }));
    const acks = resumed.filter(c => c.type === 'tool-call-resumed');
    expect(acks).toHaveLength(1);
    expect(acks[0].payload).toMatchObject({ toolCallId: 'tc-appr', kind: 'approval', args: { value: 'x' } });
    const resultIndex = resumed.findIndex(c => c.type === 'tool-result' && c.payload.toolCallId === 'tc-appr');
    expect(resultIndex).toBeGreaterThan(resumed.indexOf(acks[0]));
  });

  it('does not ack a fresh call whose model args carry resumeData', async () => {
    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'ask',
      tools: { askUser },
      stopWhen: stepCountIs(3),
      collectChunks: true,
      fixtures: llm =>
        callThenFinish(llm, 'tc-fresh', 'askUser', { question: 'color?', resumeData: { answer: 'red' } }),
    });
    expect(chunks!.some(c => c.type === 'tool-result' && (c as any).payload.toolCallId === 'tc-fresh')).toBe(true);
    expect(chunks!.some(c => c.type === 'tool-call-resumed')).toBe(false);
  });
});
