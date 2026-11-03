/**
 * Agent schedule fires that require the thread's claimed owner (#27844).
 *
 * Two workers share one transport, as several processes share one Redis pubsub.
 * Worker A has claimed the thread with its own stream options. Worker B takes the
 * schedule fire. With `ifIdle.requireClaimedOwner`, the wake must run on A, the
 * claim holder, and not as a second runner on B.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Agent } from '../agent';
import { AgentThreadStreamRuntime } from '../agent/thread-stream-runtime';
import { PubSub } from '../events/pubsub';
import type { EventCallback } from '../events/types';
import { Mastra } from '../mastra';
import type { ScheduleTarget } from '../storage/domains/schedules/base';
import { ScheduleInputSchema } from './types';
import type { ScheduleHooks } from './types';
import { executeAgentSchedule } from './worker';

const OWNER_DISCOVERY_PREFIX = 'agent.thread-owner-discovery';
const AGENT_ID = 'scheduled-agent';
const OWNER_INSTRUCTIONS = 'You are worker A, the claim holder.';
const FIRE_INSTRUCTIONS = 'You are worker B, the fire worker.';

/** One in-process transport shared by both workers. */
class SharedPubSub extends PubSub {
  #subscribers = new Map<string, Set<EventCallback>>();
  ownerAnswersDiscovery = true;

  async publish(topic: string, event: any): Promise<void> {
    if (
      !this.ownerAnswersDiscovery &&
      topic.startsWith(OWNER_DISCOVERY_PREFIX) &&
      event?.data?.type === 'thread-owner-response'
    ) {
      return;
    }
    for (const callback of [...(this.#subscribers.get(topic) ?? [])]) {
      await callback(event);
    }
  }

  async subscribe(topic: string, callback: EventCallback): Promise<void> {
    const subscribers = this.#subscribers.get(topic) ?? new Set<EventCallback>();
    subscribers.add(callback);
    this.#subscribers.set(topic, subscribers);
  }

  async unsubscribe(topic: string, callback: EventCallback): Promise<void> {
    this.#subscribers.get(topic)?.delete(callback);
  }

  async flush(): Promise<void> {}
}

async function waitFor(condition: () => boolean, description: string, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${description}`);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}

describe('agent schedule fires and the claimed thread owner', () => {
  let llm: LLMock;

  beforeAll(async () => {
    llm = new LLMock({ port: 0 });
    llm.on({ userMessage: /scheduled check-in/ }, { content: 'checked in' });
    await llm.start();
  });

  afterAll(async () => {
    await llm.stop();
  });

  let threadSeq = 0;

  function setup(hooks?: ScheduleHooks<Mastra>) {
    const pubsub = new SharedPubSub();
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
    const makeAgent = (instructions: string) =>
      new Agent({ id: AGENT_ID, name: AGENT_ID, instructions, model: openai('gpt-4o-mini'), pubsub });

    const ownerAgent = makeAgent(OWNER_INSTRUCTIONS);
    const ownerRuntime = new AgentThreadStreamRuntime();
    const fireAgent = makeAgent(FIRE_INSTRUCTIONS);
    const fireWorker = new Mastra({
      agents: { [AGENT_ID]: fireAgent },
      pubsub,
      logger: false,
      ...(hooks ? { schedules: hooks } : {}),
    });

    threadSeq += 1;
    const thread = { resourceId: 'schedule-owner-resource', threadId: `schedule-owner-thread-${threadSeq}` };

    // Model requests carry the system prompt, which tells the workers apart.
    const runsBy = (instructions: string) =>
      llm
        .getRequests()
        .filter(request => JSON.stringify(request.body?.messages ?? []).includes(thread.threadId))
        .filter(request => JSON.stringify(request.body?.messages ?? []).includes(instructions)).length;

    return { pubsub, ownerAgent, ownerRuntime, fireWorker, thread, runsBy };
  }

  function scheduleTarget(
    thread: { resourceId: string; threadId: string },
    ifIdle?: Extract<ScheduleTarget, { type: 'agent' }>['ifIdle'],
  ): Extract<ScheduleTarget, { type: 'agent' }> {
    return {
      type: 'agent',
      agentId: AGENT_ID,
      // The thread id goes into the prompt so each test can find its own model requests.
      prompt: `scheduled check-in for ${thread.threadId}`,
      ...thread,
      ...(ifIdle ? { ifIdle } : {}),
    };
  }

  it('keeps requireClaimedOwner when a stored ifIdle is validated', () => {
    const parsed = ScheduleInputSchema.parse({
      scheduleId: 'agent_x',
      agentId: AGENT_ID,
      prompt: 'p',
      threadId: 't',
      ifIdle: { behavior: 'wake', requireClaimedOwner: true },
    });
    expect(parsed.ifIdle).toEqual({ behavior: 'wake', requireClaimedOwner: true });
  });

  it('runs the idle wake on the claim holder when the schedule requires the claimed owner', async () => {
    const { pubsub, ownerAgent, ownerRuntime, fireWorker, thread, runsBy } = setup();
    // The claim's stream options drive the woken run on the owner to completion.
    const claim = await ownerRuntime.claimThreadOwnership(
      ownerAgent,
      { ...thread, streamOptions: { untilIdle: true } },
      pubsub,
    );
    expect(claim.claimed).toBe(true);

    const result = await executeAgentSchedule(
      fireWorker,
      'agent_claimed_owner',
      scheduleTarget(thread, { behavior: 'wake', requireClaimedOwner: true }),
    );

    expect(result).toMatchObject({ status: 'signal-accepted' });
    expect(result.outcome).not.toBe('failed');
    await waitFor(() => runsBy(OWNER_INSTRUCTIONS) > 0, 'the claim holder to run the scheduled turn');
    expect(runsBy(FIRE_INSTRUCTIONS)).toBe(0);

    claim.unsubscribe();
  }, 30_000);

  it('routes to the claim holder when the prepare hook sets requireClaimedOwner', async () => {
    const { pubsub, ownerAgent, ownerRuntime, fireWorker, thread, runsBy } = setup({
      prepare: () => ({ ifIdle: { behavior: 'wake', requireClaimedOwner: true } }),
    });
    const claim = await ownerRuntime.claimThreadOwnership(
      ownerAgent,
      { ...thread, streamOptions: { untilIdle: true } },
      pubsub,
    );

    const result = await executeAgentSchedule(fireWorker, 'agent_claimed_owner_hook', scheduleTarget(thread));

    expect(result).toMatchObject({ status: 'signal-accepted' });
    await waitFor(() => runsBy(OWNER_INSTRUCTIONS) > 0, 'the claim holder to run the scheduled turn');
    expect(runsBy(FIRE_INSTRUCTIONS)).toBe(0);

    claim.unsubscribe();
  }, 30_000);

  it('fails the fire when no claimed owner answers', async () => {
    const { pubsub, ownerAgent, ownerRuntime, fireWorker, thread, runsBy } = setup();
    const claim = await ownerRuntime.claimThreadOwnership(ownerAgent, thread, pubsub);
    pubsub.ownerAnswersDiscovery = false;

    const result = await executeAgentSchedule(
      fireWorker,
      'agent_claimed_owner_silent',
      scheduleTarget(thread, { behavior: 'wake', requireClaimedOwner: true }),
    );

    expect(result).toMatchObject({
      outcome: 'failed',
      reason: expect.stringContaining('No claimed thread owner responded'),
    });
    expect(runsBy(FIRE_INSTRUCTIONS)).toBe(0);

    claim.unsubscribe();
  }, 30_000);
});
