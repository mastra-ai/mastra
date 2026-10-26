/**
 * Aborting a published plain Agent run from a reader other than its caller:
 * `observe().abort()` and `abortRunStream()` reach the run over its control
 * topic, including from another Agent instance sharing the bus (standing in
 * for another process). Model traffic goes through AIMock.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { useLoopScenarioAimock } from '../../../loop/test-utils/aimock/aimock-scenario';
import { SCENARIO_MODEL_ID } from '../../../loop/test-utils/aimock/types';
import { Mastra } from '../../../mastra';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';

describe('Agent streams remote abort', () => {
  const getMock = useLoopScenarioAimock();

  /** An agent whose tool blocks until `stop` runs, then releases the tool. */
  const setup = (pubsub: EventEmitterPubSub) => {
    let toolStarted!: () => void;
    const started = new Promise<void>(resolve => (toolStarted = resolve));
    let release!: () => void;
    const released = new Promise<void>(resolve => (release = resolve));

    getMock().on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call_1', name: 'lookup', arguments: { q: 'x' } }] },
    );
    getMock().on({ endpoint: 'chat', hasToolResult: true }, { content: 'Should not be reached.' });

    const makeAgent = () =>
      new Agent({
        id: 'abort-agent',
        name: 'abort-agent',
        instructions: 'Use the tool.',
        model: createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${getMock().url}/v1` })(SCENARIO_MODEL_ID),
        tools: {
          lookup: createTool({
            id: 'lookup',
            description: 'Look something up',
            inputSchema: z.object({ q: z.string() }),
            outputSchema: z.object({ value: z.string() }),
            execute: async () => {
              toolStarted();
              await released;
              return { value: 'FOUND' };
            },
          }),
        },
      });

    const agent = makeAgent();
    new Mastra({ agents: { agent }, pubsub, logger: false });
    // The same agent registered on a second Mastra sharing the bus.
    const remote = makeAgent();
    new Mastra({ agents: { agent: remote }, pubsub, logger: false });
    return { agent, remote, started, release };
  };

  const finishReason = async (output: Awaited<ReturnType<Agent['stream']>>) => {
    await output.consumeStream();
    return (await output.finishReason) as string | undefined;
  };

  it('observe().abort() from another agent instance stops the run', async () => {
    const pubsub = new EventEmitterPubSub();
    const { agent, remote, started, release } = setup(pubsub);

    const output = await agent.stream('Look it up then continue.', { maxSteps: 3 });
    const done = finishReason(output);
    await started;

    const observed = await remote.observe(output.runId);
    await observed.abort();
    await pubsub.flush();
    release();

    expect(await done).toMatch(/abort|cancel/);
    expect(getMock().getRequests()).toHaveLength(1);
    observed.detach();
  });

  it('abortRunStream() on another agent instance stops the run', async () => {
    const pubsub = new EventEmitterPubSub();
    const { agent, remote, started, release } = setup(pubsub);

    const output = await agent.stream('Look it up then continue.', { maxSteps: 3 });
    const done = finishReason(output);
    await started;

    expect(remote.abortRunStream(output.runId)).toBe(false);
    await pubsub.flush();
    release();

    expect(await done).toMatch(/abort|cancel/);
    expect(getMock().getRequests()).toHaveLength(1);
  });

  it("still stops on the caller's own abort signal", async () => {
    const pubsub = new EventEmitterPubSub();
    const { agent, started, release } = setup(pubsub);
    const controller = new AbortController();

    const output = await agent.stream('Look it up then continue.', { maxSteps: 3, abortSignal: controller.signal });
    const done = finishReason(output);
    await started;
    controller.abort();
    release();

    expect(await done).toMatch(/abort|cancel/);
    expect(getMock().getRequests()).toHaveLength(1);
  });
});
