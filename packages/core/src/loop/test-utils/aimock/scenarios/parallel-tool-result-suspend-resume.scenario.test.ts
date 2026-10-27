import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory';
import type { ChunkType } from '../../../../stream/types';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Story: a banking agent looks up an account balance and starts a transfer in the same step.
 * The transfer tool pauses for the user's confirmation with a runtime `suspend()` (no
 * `suspendSchema`, so the batch still runs in parallel). The balance lookup finishes first and
 * its result streams straight away. After the user confirms with `resumeStream()`, that
 * result must not stream a second time: a `useChat` client would get two
 * `tool-output-available` parts for one call, and `processToolResult` would run twice.
 * The history sent back to the model and the saved thread keep the model's call order.
 */
describeForAllEngines('Parallel tool results across a runtime suspend and resume', engine => {
  const getMock = useLoopScenarioAimock();
  const THREAD = { threadId: 'bank-thread', resourceId: 'account-holder' };
  const callOrder = ['call_transfer', 'call_balance'];

  const resultIds = (chunks: ChunkType[]) =>
    chunks.filter(c => c.type === 'tool-result').map(c => (c.payload as { toolCallId: string }).toolCallId);

  it('streams each tool result exactly once across the first and the resumed stream', async () => {
    const memory = new MockMemory();
    let balanceDone!: () => void;
    const balanceFinished = new Promise<void>(resolve => {
      balanceDone = resolve;
    });

    const startTransfer = createTool({
      id: 'startTransfer',
      description: 'Start a transfer; asks the user to confirm first.',
      inputSchema: z.object({ amount: z.number() }),
      execute: async (input, context) => {
        const { resumeData, suspend } = context?.agent ?? {};
        if (!(resumeData as { confirmed?: boolean } | undefined)?.confirmed) {
          // Suspend after the sibling finished, so its result is ready before the run pauses.
          await balanceFinished;
          return await suspend?.({ message: `Confirm transfer of ${input.amount}?` });
        }
        return { transferred: input.amount };
      },
    });
    const getBalance = createTool({
      id: 'getBalance',
      description: 'Get the account balance.',
      inputSchema: z.object({ account: z.string() }),
      execute: async () => {
        setTimeout(balanceDone, 0);
        return { balance: 1200 };
      },
    });

    const shared = await createSharedAgent(getMock(), {
      tools: { startTransfer, getBalance },
      memory,
      engine,
    });

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'Check my balance and send 100 to Sam.',
      memory,
      ...THREAD,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              { id: 'call_transfer', name: 'startTransfer', arguments: { amount: 100 } },
              { id: 'call_balance', name: 'getBalance', arguments: { account: 'checking' } },
            ],
          },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Your balance is 1200 and 100 went to Sam.' });
      },
      collectChunks: true,
    });

    expect(chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);

    const resumed = await shared.agent.resumeStream({ confirmed: true }, { runId: output.runId, memory: THREAD });
    const resumeChunks: ChunkType[] = [];
    for await (const chunk of resumed.fullStream as AsyncIterable<ChunkType>) {
      resumeChunks.push(chunk);
    }

    // Every call's result reaches the client exactly once across both streams.
    const emitted = [...resultIds(chunks!), ...resultIds(resumeChunks)];
    expect([...emitted].sort()).toEqual([...callOrder].sort());

    expect(await resumed.text).toBe('Your balance is 1200 and 100 went to Sam.');

    // The model sees both results once, in the order it called the tools.
    const requests = getMock().getRequests();
    const sentBack = (requests.at(-1)!.body.messages as Array<{ role: string; tool_call_id?: string }>)
      .filter(m => m.role === 'tool')
      .map(m => m.tool_call_id);
    expect(sentBack).toEqual(callOrder);

    // The saved thread holds each result once, in call order.
    const savedResults = (await memory.recall(THREAD)).messages.flatMap(m =>
      (m.content.parts ?? []).flatMap(p =>
        p.type === 'tool-invocation' && p.toolInvocation.state === 'result'
          ? [[p.toolInvocation.toolCallId, p.toolInvocation.result]]
          : [],
      ),
    );
    expect(savedResults).toEqual([
      ['call_transfer', { transferred: 100 }],
      ['call_balance', { balance: 1200 }],
    ]);
  });
});
