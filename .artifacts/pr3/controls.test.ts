import { writeFileSync, appendFileSync } from 'node:fs';
import { expect, it, describe } from 'vitest';
import { InMemoryServerCache } from '../../packages/core/src/cache/inmemory';
import { AGENT_STREAM_TOPIC } from '../../packages/core/src/agent/streams/constants';
import { EventEmitterPubSub } from '../../packages/core/src/events/event-emitter';
import { createSharedAgent, useLoopScenarioAimock } from '../../packages/core/src/loop/test-utils/aimock/aimock-scenario';

const file = `${import.meta.dirname}/results/controls.jsonl`;
writeFileSync(file, '');
const log = (control: string, boundary: string, data: unknown) => appendFileSync(file, JSON.stringify({ at: performance.now(), control, boundary, data }) + '\n');
class GateCache extends InMemoryServerCache {
  release!: () => void;
  blocked = new Promise<void>(resolve => { this.release = resolve; });
  override async listPushIndexed(list: string, counter: string, value: Record<string, unknown>, ttl?: number) {
    await this.blocked;
    return super.listPushIndexed(list, counter, value, ttl);
  }
}
class BrokenAppendCache extends InMemoryServerCache {
  override async listPushIndexed(): Promise<number> { throw new Error('PR3 deliberate append outage'); }
}
class BrokenStreamTransport extends EventEmitterPubSub {
  override async publish(topic: string, event: any, options?: any) {
    if (topic.startsWith(AGENT_STREAM_TOPIC(''))) throw new Error('PR3 deliberate stream transport outage');
    return super.publish(topic, event, options);
  }
}
for (const engine of ['normal', 'durable', 'evented'] as const) describe(engine, () => {
  const getMock = useLoopScenarioAimock();
  for (const control of ['gate', ...(engine === 'normal' ? ['append-outage', 'transport-outage'] : [])]) it(control, async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: 'Control response.' });
    const cache = control === 'gate' ? new GateCache() : control === 'append-outage' ? new BrokenAppendCache() : new InMemoryServerCache();
    const pubsub = control === 'transport-outage' ? new BrokenStreamTransport() : new EventEmitterPubSub();
    const { agent, mastra }: any = await createSharedAgent(llm, { engine, cache, pubsub });
    let run: any;
    try {
      run = await agent.stream('Respond.', { runId: crypto.randomUUID() });
      let complete = false;
      const frames: any[] = [];
      const drain = (async () => {
        for await (const frame of run.fullStream) {
          frames.push(frame); log(`${engine}/${control}`, 'caller', frame);
        }
        complete = true;
      })();
      await new Promise(resolve => setTimeout(resolve, 350));
      log(`${engine}/${control}`, 'before-release', { complete, count: frames.length });
      if (control === 'gate') {
        expect(complete).toBe(engine === 'normal');
        (cache as GateCache).release();
      }
      await drain;
      expect(frames.filter(x => x.type === 'text-delta').map(x => x.payload.text).join('')).toBe('Control response.');
      expect(frames.filter(x => x.type === 'finish')).toHaveLength(1);
      const bus = agent.__getStreamBus?.()?.pubsub ?? agent.pubsub;
      await new Promise(resolve => setTimeout(resolve, 30));
      const history = await bus.getHistory(AGENT_STREAM_TOPIC(run.runId));
      log(`${engine}/${control}`, 'retained', history);
      if (control === 'append-outage') expect(history).toHaveLength(0);
    } finally {
      if (cache instanceof GateCache) cache.release();
      run?.cleanup?.(); await mastra.shutdown();
    }
  });
});
