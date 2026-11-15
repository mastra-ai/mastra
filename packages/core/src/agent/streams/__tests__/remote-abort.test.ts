/**
 * Aborting a published plain Agent run from a reader other than its caller:
 * `observe().abort()` and `abortRunStream()` reach the run over its control
 * topic, including from another Agent instance sharing the bus (standing in
 * for another process). Model traffic goes through AIMock.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { useLoopScenarioAimock } from '../../../loop/test-utils/aimock/aimock-scenario';
import { SCENARIO_MODEL_ID } from '../../../loop/test-utils/aimock/types';
import { Mastra } from '../../../mastra';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '../../../request-context';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { requestAcknowledgedAbort } from '../abort-transport';
import { AGENT_CONTROL_TOPIC } from '../constants';
import { createAgentStreamPublisher } from '../publisher';

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

  it('__abortRunAcknowledged() on another agent instance stops the run and confirms it', async () => {
    const pubsub = new EventEmitterPubSub();
    const { agent, remote, started, release } = setup(pubsub);

    const output = await agent.stream('Look it up then continue.', { maxSteps: 3 });
    const done = finishReason(output);
    await started;

    // The confirmation is the executing instance's answer, not a local boolean.
    expect(remote.abortRunStream(output.runId)).toBe(false);
    expect(await remote.__abortRunAcknowledged(output.runId)).toBe(true);
    release();

    expect(await done).toMatch(/abort|cancel/);
    expect(getMock().getRequests()).toHaveLength(1);
  });

  it('__abortRunAcknowledged() reports false when no process runs the run', async () => {
    const pubsub = new EventEmitterPubSub();
    const { remote } = setup(pubsub);
    expect(await remote.__abortRunAcknowledged('nobody-runs-this')).toBe(false);
  });

  it('does not confirm an abort that reaches a run after it ended', async () => {
    // A transport that releases subscriptions slowly (as Redis Streams does)
    // still delivers control requests while the ended run unsubscribes.
    let releaseUnsubscribe!: () => void;
    const unsubscribing = new Promise<void>(resolve => (releaseUnsubscribe = resolve));
    class SlowUnsubscribePubSub extends EventEmitterPubSub {
      override async unsubscribe(topic: string, cb: Parameters<EventEmitterPubSub['unsubscribe']>[1]) {
        if (topic === AGENT_CONTROL_TOPIC('ended-run')) await unsubscribing;
        return super.unsubscribe(topic, cb);
      }
    }
    const pubsub = new SlowUnsubscribePubSub();
    const publisher = createAgentStreamPublisher({ pubsub, runId: 'ended-run', cleanupTimeoutMs: 0 });
    await pubsub.flush();
    publisher.publish({ type: 'finish', runId: 'ended-run', from: 'AGENT', payload: {} } as any);
    await publisher.close();

    expect(await requestAcknowledgedAbort(pubsub, 'ended-run', 300)).toBe(false);
    expect(publisher.abortSignal.aborted).toBe(false);
    releaseUnsubscribe();
  });

  it('records the owner of a running published run and forgets it once the run ends', async () => {
    const pubsub = new EventEmitterPubSub();
    const { agent, started, release } = setup(pubsub);

    const output = await agent.stream('Look it up then continue.', {
      maxSteps: 3,
      requestContext: new RequestContext([[MASTRA_RESOURCE_ID_KEY, 'user-1']]),
    });
    const done = finishReason(output);
    await started;

    expect(agent.__getPublishedRunOwner(output.runId)).toEqual({ resourceId: 'user-1', threadId: undefined });
    expect(agent.abortRunStream(output.runId)).toBe(true);
    release();

    expect(await done).toMatch(/abort|cancel/);
    expect(getMock().getRequests()).toHaveLength(1);
    await pubsub.flush();
    await vi.waitFor(() => expect(agent.__getPublishedRunOwner(output.runId)).toBeUndefined());
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
