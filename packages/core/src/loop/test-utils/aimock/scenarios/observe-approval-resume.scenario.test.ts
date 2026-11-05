/**
 * AIMock Scenario: observing a run across an approval suspension
 *
 * Suspension is an event, not the end of a run. On every engine an observer
 * attached before or during the suspension follows the publicly approved run
 * (same runId) to its finish, a fresh replay of the finished run contains both
 * segments, and reconnecting just past the suspension index yields only the
 * resumed segment. The tool runs once, `onSuspended` fires once, and a reader
 * that cancels detaches without stopping the run.
 */
import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../../../../agent/streams/constants';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';

type Chunk = { type: string; payload?: any };
type Observation = { fullStream: AsyncIterable<Chunk>; detach: () => void };

/** Drains an observation; reports whether it closed on its own before `ms`. */
async function drain(observation: Observation, ms: number) {
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    observation.detach();
  }, ms);
  const chunks: Chunk[] = [];
  try {
    for await (const chunk of observation.fullStream) chunks.push(chunk);
  } finally {
    clearTimeout(timer);
    observation.detach();
  }
  return { types: chunks.map(chunk => chunk.type), chunks, timedOut };
}

const textOf = (chunks: Chunk[]) =>
  chunks
    .filter(chunk => chunk.type === 'text-delta')
    .map(chunk => chunk.payload?.text ?? '')
    .join('');

/** The bus a run's events are published on: a plain agent's stream bus, else the durable agent's pubsub. */
const runBus = (agent: any) => agent.__getStreamBus?.()?.pubsub ?? agent.pubsub;

describeForAllEngines('AIMock loop scenario: observe across approval and resume', engine => {
  const getMock = useLoopScenarioAimock();

  it('follows the approved run to its finish and replays both segments', async () => {
    const llm = getMock();
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call_approve', name: 'lookup_status', arguments: { query: 'alpha' } }] },
    );
    llm.on(
      { endpoint: 'chat', hasToolResult: true },
      { content: 'Approved and done.' },
      { streamingProfile: { ttft: 300 } },
    );
    const execute = vi.fn(async ({ query }: { query: string }) => ({ status: `OK:${query}` }));
    const lookup = createTool({
      id: 'lookup_status',
      description: 'Look up a status.',
      inputSchema: z.object({ query: z.string() }),
      execute,
    });
    const { agent, mastra } = await createSharedAgent(llm, { engine, tools: { lookup_status: lookup } });
    const run: any = await agent.stream('Look up alpha', { requireToolApproval: true, maxSteps: 5 });
    const onSuspended = vi.fn();
    // Attached before the suspension.
    const initial = drain((await agent.observe(run.runId, { onSuspended })) as Observation, 20_000);

    let toolCallId: string | undefined;
    for await (const chunk of run.fullStream) {
      if (chunk.type === 'tool-call-approval') {
        toolCallId = chunk.payload.toolCallId;
        break;
      }
    }
    expect(toolCallId).toBe('call_approve');

    let resumed: any;
    try {
      const bus = runBus(agent);
      const topic = AGENT_STREAM_TOPIC(run.runId);
      let suspensionIndex: number | undefined;
      await vi.waitFor(async () => {
        const history: any[] = await bus.getHistory(topic);
        suspensionIndex = history.find(event => event.type === AgentStreamEventTypes.SUSPENDED)?.index;
        expect(suspensionIndex).toBeTypeOf('number');
      });

      // Attached while the run is parked.
      const duringSuspension = drain((await agent.observe(run.runId)) as Observation, 20_000);
      // A reader that cancels while the run is parked detaches; it must not stop the run.
      const cancelled = (await agent.observe(run.runId)) as Observation;
      for await (const _chunk of cancelled.fullStream) break;
      await new Promise(resolve => setTimeout(resolve, 300));

      resumed = await agent.approveToolCall({ runId: run.runId, toolCallId: toolCallId! });
      await resumed.consumeStream();

      for (const observed of [await initial, await duringSuspension]) {
        expect(observed.timedOut).toBe(false);
        expect(observed.types).toContain('tool-call-approval');
        expect(observed.types).toContain('tool-result');
        expect(textOf(observed.chunks)).toBe('Approved and done.');
        expect(observed.types.at(-1)).toBe('finish');
      }
      expect(execute).toHaveBeenCalledTimes(1);
      expect(onSuspended).toHaveBeenCalledTimes(1);

      // A fresh replay of the finished run holds the suspended segment and the resumed one.
      const replay = await drain((await agent.observe(run.runId)) as Observation, 5_000);
      expect(replay.timedOut).toBe(false);
      expect(replay.types).toContain('tool-call-approval');
      expect(replay.types).toContain('tool-result');
      expect(textOf(replay.chunks)).toBe('Approved and done.');
      expect(replay.types.at(-1)).toBe('finish');

      // Reconnecting just past the transport's suspension index yields the resumed segment once.
      const tail = await drain(
        (await agent.observe(run.runId, { offset: suspensionIndex! + 1 })) as Observation,
        5_000,
      );
      expect(tail.timedOut).toBe(false);
      expect(tail.types).not.toContain('tool-call-approval');
      expect(textOf(tail.chunks)).toBe('Approved and done.');
      expect(tail.types.filter(type => type === 'finish')).toHaveLength(1);
    } finally {
      resumed?.cleanup?.();
      run.cleanup?.();
      if (engine !== 'inngest') await mastra.shutdown();
    }
  }, 30_000);
});
