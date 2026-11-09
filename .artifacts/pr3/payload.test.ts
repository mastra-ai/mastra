import { appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expect, it, describe, vi } from 'vitest';
import { z } from 'zod/v4';
import { Memory } from '../../packages/memory/src';
import { createTool } from '../../packages/core/src/tools';
import { InMemoryServerCache } from '../../packages/core/src/cache/inmemory';
import { EventEmitterPubSub } from '../../packages/core/src/events/event-emitter';
import { AGENT_STREAM_TOPIC } from '../../packages/core/src/agent/streams/constants';
import { createSharedAgent, useLoopScenarioAimock } from '../../packages/core/src/loop/test-utils/aimock/aimock-scenario';

const dir = `${import.meta.dirname}/results`;
mkdirSync(dir, { recursive: true });
const clone = (x: any) => JSON.parse(JSON.stringify(x));
const text = (xs: any[]) => xs.filter(x => x.type === 'text-delta').map(x => x.payload.text).join('');
const summary = (xs: any[]) => ({ text: text(xs), types: xs.map(x => x.type), indexes: xs.map(x => x.index ?? null), lifecycle: xs.filter(x => ['step-finish', 'finish'].includes(x.type)) });

class SerializedTransport extends EventEmitterPubSub {
  override async publish(...args: Parameters<EventEmitterPubSub['publish']>) {
    return super.publish(args[0], clone(args[1]), args[2]);
  }
}

class SnapshotCache extends InMemoryServerCache {
  override async listPushIndexed(listKey: string, counterKey: string, value: Record<string, unknown>, ttlMs?: number) {
    return super.listPushIndexed(listKey, counterKey, clone(value), ttlMs);
  }
}

for (const engine of ['normal', 'durable', 'evented'] as const) describe(engine, () => {
  const getMock = useLoopScenarioAimock();
  for (const variant of ['text', 'approval', 'serialized-approval', ...(engine === 'normal' ? ['snapshot-approval'] : [])]) it(variant, async () => {
    const approval = variant !== 'text';
    const name = `${engine}-${variant}`;
    const file = `${dir}/${name}.jsonl`;
    writeFileSync(file, '');
    const log = (boundary: string, frame: any) => appendFileSync(file, JSON.stringify({ at: performance.now(), boundary, frame }) + '\n');
    const llm = getMock();
    if (approval) {
      llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [{ id: 'call_approve', name: 'lookup_status', arguments: { query: 'alpha' } }] });
      llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Approved and done.' }, { streamingProfile: { ttft: 250 } });
    } else llm.on({ endpoint: 'chat' }, { content: 'Plain response.' }, { streamingProfile: { ttft: 250 } });
    let executions = 0;
    const lookup = createTool({ id: 'lookup_status', description: 'Look up status', inputSchema: z.object({ query: z.string() }), execute: async ({ query }) => { executions++; return { status: `OK:${query}` }; } });
    const memory = new Memory({ options: { semanticRecall: false, generateTitle: false } });
    const { agent, mastra }: any = await createSharedAgent(llm, { engine, memory, tools: { lookup_status: lookup }, ...(variant === 'snapshot-approval' || variant === 'serialized-approval' ? { cache: new SnapshotCache() } : {}), ...(variant === 'serialized-approval' ? { pubsub: new SerializedTransport() } : {}) });
    let run: any, resumed: any;
    const observers: any[] = [];
    const collect = async (stream: any, label: string, stopOnApproval = false) => {
      const xs: any[] = [];
      for await (const chunk of stream.fullStream) {
        const frame = clone(chunk); xs.push(frame); log(label, frame);
        if (stopOnApproval && chunk.type === 'tool-call-approval') break;
      }
      return xs;
    };
    const observe = async (runId: string, label: string, options = {}) => {
      const output = await agent.observe(runId, options); observers.push(output);
      let timeout = false;
      const timer = setTimeout(() => { timeout = true; output.detach(); }, 12000);
      const frames = await collect(output, label).finally(() => clearTimeout(timer));
      expect(timeout, `${label} timeout`).toBe(false);
      return frames;
    };
    try {
      const runId = randomUUID();
      const options = { runId, maxSteps: 5, requireToolApproval: approval, memory: { thread: `pr3-${runId}`, resource: 'pr3' } };
      run = await agent.stream('Look up alpha', options);
      const livePromise = observe(runId, 'live');
      const caller = await collect(run, 'caller-initial', approval);
      const bus = agent.__getStreamBus?.()?.pubsub ?? agent.pubsub;
      const topic = AGENT_STREAM_TOPIC(runId);
      let suspensionIndex: number | undefined;
      let resumedFrames: any[] = [];
      if (approval) {
        await vi.waitFor(async () => {
          const history = await bus.getHistory(topic);
          suspensionIndex = history.find((e: any) => e.type === 'suspended')?.index;
          expect(suspensionIndex).toBeTypeOf('number');
        }, { timeout: 5000 });
        resumed = await agent.approveToolCall({ runId, toolCallId: 'call_approve' });
        resumedFrames = await collect(resumed, 'caller-resumed');
      }
      const live = await livePromise;
      const replay = await observe(runId, 'replay');
      const tail = approval ? await observe(runId, 'offset-replay', { offset: suspensionIndex! + 1 }) : [];
      const history = clone(await bus.getHistory(topic));
      history.forEach((e: any) => log('retained-topic', e));
      const expectedText = approval ? 'Approved and done.' : 'Plain response.';
      expect(text(live)).toBe(expectedText);
      expect(text(replay)).toBe(expectedText);
      expect(replay.filter(x => x.type === 'finish')).toHaveLength(1);
      expect(executions).toBe(approval ? 1 : 0);
      expect(live.every(x => typeof x.index === 'number')).toBe(true);
      expect(replay.map(x => x.index)).toEqual(live.map(x => x.index));
      if (engine === 'normal') expect(caller.every(x => x.index === undefined)).toBe(true);
      else expect(caller.every(x => typeof x.index === 'number')).toBe(true);
      if (approval) {
        expect(text(tail)).toBe(expectedText);
        expect(tail.some(x => x.type === 'tool-call-approval')).toBe(false);
        expect(tail.every(x => x.index > suspensionIndex!)).toBe(true);
        expect(tail.filter(x => x.type === 'finish')).toHaveLength(1);
      }
      if (approval && engine === 'normal') {
        const liveStep = live.find(x => x.type === 'step-finish');
        const replayStep = replay.find(x => x.type === 'step-finish');
        expect(liveStep.payload.output.steps).toHaveLength(1);
        expect(replayStep.payload.output.steps).toHaveLength(variant === 'approval' ? 2 : 1);
      }
      const direct = approval ? resumedFrames : caller;
      const callerFinish = direct.find(x => x.type === 'finish');
      const replayFinish = replay.find(x => x.type === 'finish');
      if (engine === 'normal') {
        expect(callerFinish.payload).toHaveProperty('metadata');
        expect(replayFinish.payload).not.toHaveProperty('metadata');
      }
      writeFileSync(`${dir}/${name}.summary.json`, JSON.stringify({ engine, approval, runId, executions, suspensionIndex, caller: summary(caller), resumed: summary(resumedFrames), live: summary(live), replay: summary(replay), offsetReplay: summary(tail), topicTypes: history.map((x: any) => ({ type: x.type, index: x.index })) }, null, 2));
    } finally {
      observers.forEach(x => x.detach()); resumed?.cleanup?.(); run?.cleanup?.(); await mastra.shutdown();
    }
  });
});
