import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import type { ChunkType } from '../../../../stream/types';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import type { RunLoopScenarioOptions } from '../types';

/**
 * A finish reason of 'tool-calls' only says the last step called a tool. Running out of
 * maxSteps, stopping on a client tool and an onIterationComplete `continue: false` all end
 * the run that way, and at maxSteps 1 they also use the same number of steps. Studio shows
 * "reached maxSteps" from the finish chunk, so the chunk carries why the loop stopped, both
 * on the caller's own stream and on the slimmed copy thread subscribers receive. (#29612)
 */

// Bounded so a missing delivery fails the test instead of hanging it.
function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs = 5000): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timeout));
}

type FinishChunk = Extract<ChunkType, { type: 'finish' }>;

async function readFinish(iterator: AsyncIterator<ChunkType>): Promise<FinishChunk> {
  for (;;) {
    const next = await iterator.next();
    if (next.done) throw new Error('thread subscription ended before the run finished');
    if (next.value.type === 'finish') return next.value;
  }
}

const lookup = createTool({
  id: 'lookup',
  description: 'Look something up',
  inputSchema: z.object({ query: z.string() }),
  execute: async () => ({ found: true }),
});

// A client tool has no execute: the browser runs it, so the loop stops and hands it back.
const askUser = createTool({
  id: 'askUser',
  description: 'Ask the user a question in the browser',
  inputSchema: z.object({ question: z.string() }),
});

const cases: Array<{
  name: string;
  toolName: 'lookup' | 'askUser';
  options: Pick<RunLoopScenarioOptions, 'clientTools' | 'onIterationComplete' | 'stopWhen'>;
  stopCause: NonNullable<FinishChunk['payload']['stopCause']>;
  /** Inngest's agentic loop has no onIterationComplete step yet, so the hook cannot stop it. */
  hookStop?: true;
}> = [
  { name: 'it runs out of steps mid tool loop', toolName: 'lookup', options: {}, stopCause: 'max_steps' },
  {
    name: 'it stops on a client tool on its last allowed step',
    toolName: 'askUser',
    options: { clientTools: { askUser } },
    stopCause: 'model_finished',
  },
  {
    name: 'onIterationComplete stops it on its last allowed step',
    toolName: 'lookup',
    options: { onIterationComplete: () => ({ continue: false }) },
    stopCause: 'iteration_hook',
    hookStop: true,
  },
  {
    name: 'onIterationComplete stops it with feedback on its last allowed step',
    toolName: 'lookup',
    options: { onIterationComplete: () => ({ continue: false, feedback: 'Wait for the user to pick a style.' }) },
    stopCause: 'iteration_hook',
    hookStop: true,
  },
  {
    // The default loop also receives maxSteps as a stop condition, which matches on this step too.
    name: 'stopWhen stops it on its last allowed step',
    toolName: 'lookup',
    options: { stopWhen: ({ steps }: { steps: unknown[] }) => steps.length > 0 },
    stopCause: 'stop_condition',
  },
];

describeForAllEngines('AIMock scenario: the finish chunk says why the run stopped', engine => {
  const getMock = useLoopScenarioAimock();

  const fixtures = (toolName: string) => (llm: any) => {
    llm.on(
      { endpoint: 'chat' },
      { toolCalls: [{ id: `call_${toolName}`, name: toolName, arguments: { query: 'poster styles' } }] },
    );
  };

  // Pinned with it.fails on Inngest until its loop runs onIterationComplete; it reports max_steps.
  const runsOnEngine = cases.filter(c => !(engine === 'inngest' && c.hookStop));
  const failsOnEngine = cases.filter(c => engine === 'inngest' && c.hookStop);

  const onStream = async ({ toolName, options, stopCause }: (typeof cases)[number]) => {
    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Make me a poster',
      tools: { lookup },
      maxSteps: 1,
      collectChunks: true,
      fixtures: fixtures(toolName),
      ...options,
    });

    const finish = chunks?.find((chunk): chunk is FinishChunk => chunk.type === 'finish');
    expect(finish?.payload.stepResult.reason).toBe('tool-calls');
    expect(finish?.payload.stopCause).toBe(stopCause);
  };

  const onThreadSubscription = async ({ toolName, options, stopCause }: (typeof cases)[number]) => {
    const memory = new MockMemory();
    const shared = await createSharedAgent(getMock(), { memory, engine, tools: { lookup } });
    const run = (threadId: string) =>
      runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Make me a poster',
        sharedAgent: shared,
        memory,
        threadId,
        resourceId: 'poster-user',
        maxSteps: 1,
        fixtures: fixtures(toolName),
        ...options,
      });
    // The first run wraps the shared agent for this engine.
    await (await run('warmup-thread')).output.consumeStream();

    const subscription = await shared.agent.subscribeToThread({ threadId: 'poster-thread', resourceId: 'poster-user' });
    try {
      const broadcastFinish = readFinish(subscription.stream[Symbol.asyncIterator]());
      await (await run('poster-thread')).output.consumeStream();

      const finish = await withTimeout(broadcastFinish, 'the thread subscriber got no finish');
      expect(finish.payload.stepResult.reason).toBe('tool-calls');
      // Broadcast copies drop the steps, so the stop cause is all a subscriber has to go on.
      expect(finish.payload.output.steps).toBeUndefined();
      expect(finish.payload.stopCause).toBe(stopCause);
    } finally {
      subscription.unsubscribe();
    }
  };

  const streamName = 'on the stream when $name at maxSteps 1';
  const threadName = 'on the thread subscription when $name at maxSteps 1';
  if (runsOnEngine.length > 0) {
    it.each(runsOnEngine)(streamName, onStream);
    it.each(runsOnEngine)(threadName, onThreadSubscription);
  }
  if (failsOnEngine.length > 0) {
    it.fails.each(failsOnEngine)(streamName, onStream);
    it.fails.each(failsOnEngine)(threadName, onThreadSubscription);
  }

  const toolCallEveryTurn = (turns: number) => (llm: any) => {
    for (let turn = 0; turn < turns; turn++) {
      llm.on(
        { endpoint: 'chat', sequenceIndex: turn },
        { toolCalls: [{ id: `lookup-${turn}`, name: 'lookup', arguments: { query: `poster style ${turn}` } }] },
      );
    }
  };

  // Technical: the default loop also receives maxSteps as a stop condition, which matched on the
  // feedback turn and replaced its cause with max_steps. The hook asked for exactly one more
  // turn, so the run ended as requested, not because the budget ran out. (#29612)
  // Pinned with it.fails on Inngest until its loop runs onIterationComplete; it reports max_steps.
  const itUnlessInngest = engine === 'inngest' ? it.fails : it;
  itUnlessInngest('says the feedback turn ended the run when that turn uses the last allowed step', async () => {
    const { chunks, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Make me a poster',
      tools: { lookup },
      maxSteps: 2,
      collectChunks: true,
      onIterationComplete: ({ iteration }: { iteration: number }) =>
        iteration === 1 ? { continue: false, feedback: 'Wait for the user to pick a style.' } : undefined,
      fixtures: toolCallEveryTurn(2),
    });

    expect(requests).toHaveLength(2);
    expect(JSON.stringify(requests[1]?.body)).toContain('Wait for the user to pick a style.');
    const finish = chunks?.find((chunk): chunk is FinishChunk => chunk.type === 'finish');
    expect(finish?.payload.stepResult.reason).toBe('tool-calls');
    expect(finish?.payload.stopCause).toBe('feedback_complete');
  });

  // Technical: with neither maxSteps nor stopWhen the default loop caps the run at five steps
  // through an unmarked stepCountIs(5), so hitting it reported stop_condition and Studio
  // stayed quiet about the exhausted budget. (#29612)
  it('says the run ran out of steps when it hits the default five-step cap', async () => {
    const { chunks, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Make me a poster',
      tools: { lookup },
      collectChunks: true,
      fixtures: toolCallEveryTurn(5),
    });

    expect(requests).toHaveLength(5);
    const finish = chunks?.find((chunk): chunk is FinishChunk => chunk.type === 'finish');
    expect(finish?.payload.stepResult.reason).toBe('tool-calls');
    expect(finish?.payload.stopCause).toBe('max_steps');
  });
});
