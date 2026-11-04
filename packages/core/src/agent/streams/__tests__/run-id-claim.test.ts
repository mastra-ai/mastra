/**
 * A published run's id identifies one run: its stream topic and ownership record
 * are keyed by it. A caller-supplied `runId` is only a claim, so starting a run
 * on an id another run already holds is refused instead of taking that run over.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import { describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { useLoopScenarioAimock } from '../../../loop/test-utils/aimock/aimock-scenario';
import { SCENARIO_MODEL_ID } from '../../../loop/test-utils/aimock/types';
import { Mastra } from '../../../mastra';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '../../../request-context';
import { Agent } from '../../agent';
import type { AgentConfig } from '../../types';
import { AGENT_STREAM_TOPIC } from '../constants';

class RecordingPubSub extends EventEmitterPubSub {
  readonly published: Array<{ topic: string; event: Omit<Event, 'id' | 'createdAt'> }> = [];

  override async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>, options?: { localOnly?: boolean }) {
    if (topic.startsWith('agent.stream.')) this.published.push({ topic, event });
    return super.publish(topic, event, options);
  }

  count(runId: string) {
    return this.published.filter(p => p.topic === AGENT_STREAM_TOPIC(runId)).length;
  }
}

const RUN_ID_CLAIMED = { id: 'AGENT_RUN_ID_ALREADY_CLAIMED' };

describe('run id ownership', () => {
  const getMock = useLoopScenarioAimock();

  const makeAgent = (config: Partial<AgentConfig<any, any, any>> = {}) => {
    getMock().on({ endpoint: 'chat' }, { content: 'Hello there.' });
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${getMock().url}/v1` });
    return new Agent({
      id: 'run-id-agent',
      name: 'run-id-agent',
      instructions: 'Be brief.',
      model: openai(SCENARIO_MODEL_ID),
      ...config,
    } as AgentConfig<any, any, any>);
  };

  const resource = (id: string) => new RequestContext([[MASTRA_RESOURCE_ID_KEY, id]]);

  it('refuses a runId another resource is already running', async () => {
    const pubsub = new RecordingPubSub();
    const agent = makeAgent();
    new Mastra({ agents: { agent }, pubsub, logger: false });

    const first = await agent.stream('Say hello.', { runId: 'shared-run', requestContext: resource('tenant-a') });
    await first.consumeStream();
    const publishedByOwner = pubsub.count('shared-run');

    await expect(
      agent.stream('Say hello.', { runId: 'shared-run', requestContext: resource('tenant-b') }),
    ).rejects.toMatchObject(RUN_ID_CLAIMED);

    // The owner keeps the record, and the refused run published nothing on its topic.
    expect(await agent.__getRunRecord('shared-run')).toMatchObject({ resourceId: 'tenant-a' });
    expect(pubsub.count('shared-run')).toBe(publishedByOwner);
  });

  it('keeps the run id with its owner after the run finishes', async () => {
    const agent = makeAgent();
    new Mastra({ agents: { agent }, pubsub: new RecordingPubSub(), logger: false });

    const first = await agent.stream('Say hello.', { runId: 'finished-run', requestContext: resource('tenant-a') });
    await first.consumeStream();

    await expect(
      agent.stream('Say hello.', { runId: 'finished-run', requestContext: resource('tenant-b') }),
    ).rejects.toMatchObject(RUN_ID_CLAIMED);

    // The owner can still reuse it.
    const again = await agent.stream('Say hello.', { runId: 'finished-run', requestContext: resource('tenant-a') });
    await again.consumeStream();
    expect(await agent.__getRunRecord('finished-run')).toMatchObject({ resourceId: 'tenant-a' });
  });

  it('refuses a scoped run id to a caller without a resource id', async () => {
    const agent = makeAgent();
    new Mastra({ agents: { agent }, pubsub: new RecordingPubSub(), logger: false });

    const first = await agent.stream('Say hello.', { runId: 'scoped-run', requestContext: resource('tenant-a') });
    await first.consumeStream();

    await expect(agent.stream('Say hello.', { runId: 'scoped-run' })).rejects.toMatchObject(RUN_ID_CLAIMED);
  });

  it('allows unscoped runs to reuse a run id', async () => {
    const agent = makeAgent();
    new Mastra({ agents: { agent }, pubsub: new RecordingPubSub(), logger: false });

    const first = await agent.stream('Say hello.', { runId: 'unscoped-run' });
    await first.consumeStream();
    const again = await agent.stream('Say hello.', { runId: 'unscoped-run' });
    await again.consumeStream();

    expect(await agent.__getRunRecord('unscoped-run')).toMatchObject({ runId: 'unscoped-run' });
  });
});
