import { expect, it } from 'vitest';
import { InMemoryServerCache } from '../../../../cache/inmemory';
import { CachingPubSub } from '../../../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../../../events/event-emitter';
import { AGENT_STREAM_TOPIC } from '../../../../agent/durable/constants';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  useLoopScenarioAimock,
} from '../aimock-scenario';

const REPLY = 'One reply.';

async function collect(stream: AsyncIterable<{ type: string; payload?: any }>) {
  const chunks: { type: string; payload?: any }[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

const text = (chunks: { type: string; payload?: any }[]) =>
  chunks
    .filter(chunk => chunk.type === 'text-delta')
    .map(chunk => chunk.payload?.text ?? '')
    .join('');

describeForAllEngines('AIMock loop scenario: observe frames', engine => {
  const getMock = useLoopScenarioAimock();

  it('delivers one reply and one finish, including replay on engines with observe()', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: REPLY });
    const { agent } = await createSharedAgent(llm, { engine });
    const run = await agent.stream('Go', { maxSteps: 2 });
    const live = await collect(run.fullStream);

    try {
      expect(text(live)).toBe(REPLY);
      expect(live.filter(chunk => chunk.type === 'finish')).toHaveLength(1);

      // Inngest's observe() replay does not close after the finished run in this harness.
      // Assert its live frames without treating that lifecycle gap as parity with local engines.
      if (isDurableEngineVariant(engine) && engine !== 'inngest') {
        const observation = await agent.observe(run.runId);
        try {
          const replay = await collect(observation.fullStream);
          expect(text(replay)).toBe(REPLY);
          expect(replay.filter(chunk => chunk.type === 'finish')).toHaveLength(1);
        } finally {
          observation.detach();
        }
      }
    } finally {
      run.cleanup?.();
    }
  });

  // Technical: durable generate() used to clear its run log on return, so a
  // caller whose HTTP request dropped could not read the answer back by run ID.
  if (isDurableEngineVariant(engine) && engine !== 'inngest') {
    it('lets a generate() caller read its finished answer again by run ID', async () => {
      const llm = getMock();
      llm.on({ endpoint: 'chat' }, { content: REPLY });
      const { agent } = await createSharedAgent(llm, { engine });
      const result = await agent.generate('Go', { maxSteps: 2 });
      expect(result.text).toBe(REPLY);

      const observation = await agent.observe(result.runId!);
      try {
        const replayed = await observation.output.getFullOutput();
        expect(replayed.text).toBe(result.text);
        expect(replayed.finishReason).toBe(result.finishReason);
        expect(replayed.usage).toEqual(result.usage);
        expect(replayed.steps.map(step => step.text)).toEqual(result.steps.map(step => step.text));
      } finally {
        observation.detach();
      }
    });
  }

  if (engine === 'evented') {
    it('caches each evented step frame once with a prewrapped pubsub', async () => {
      const llm = getMock();
      llm.on({ endpoint: 'chat' }, { content: REPLY });
      const cache = new InMemoryServerCache();
      const pubsub = new CachingPubSub(new EventEmitterPubSub(), cache);
      const { agent } = await createSharedAgent(llm, { engine, pubsub, cache });
      const run = await agent.stream('Go', { maxSteps: 2 });
      await run.output.consumeStream();

      try {
        const observation = await agent.observe(run.runId);
        try {
          const replay = await collect(observation.fullStream);
          expect(text(replay)).toBe(REPLY);
          expect(replay.filter(chunk => chunk.type === 'finish')).toHaveLength(1);
        } finally {
          observation.detach();
        }

        const events = (await cache.listFromTo(`pubsub:${AGENT_STREAM_TOPIC(run.runId)}`, 0)) as {
          type: string;
          data?: { type?: string; payload?: { text?: string } };
        }[];
        expect(events.filter(event => event.type === 'chunk' && event.data?.type === 'text-delta')).toHaveLength(1);
        expect(events.filter(event => event.type === 'finish')).toHaveLength(1);
      } finally {
        run.cleanup?.();
      }
    });
  }
});
