/**
 * Pins the `agent.stream.<runId>` events a run publishes, on the default
 * durable engine and the evented engine, through a real provider pointed at
 * AIMock. Resumable-stream readers (observe, reconnect, server routes) depend
 * on this sequence, so moving the stream layer must not change it.
 */
import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { runLoopScenario, useLoopScenarioAimock } from '../../../loop/test-utils/aimock/aimock-scenario';
import type { RunLoopScenarioOptions } from '../../../loop/test-utils/aimock/types';
import { createTool } from '../../../tools';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../constants';

type Published = Omit<Event, 'id' | 'createdAt'>;

class RecordingPubSub extends EventEmitterPubSub {
  readonly published = new Map<string, Published[]>();

  override async publish(topic: string, event: Published, options?: { localOnly?: boolean }): Promise<void> {
    if (topic.startsWith('agent.stream.')) {
      const events = this.published.get(topic) ?? [];
      events.push(event);
      this.published.set(topic, events);
    }
    return super.publish(topic, event, options);
  }
}

const TERMINAL = new Set<string>([
  AgentStreamEventTypes.FINISH,
  AgentStreamEventTypes.ERROR,
  AgentStreamEventTypes.ABORT,
  AgentStreamEventTypes.SUSPENDED,
]);

/** One label per event, with consecutive repeats (e.g. text deltas) collapsed. */
function describeEvents(events: Published[]): string[] {
  const labels = events.map(event => {
    const data = event.data as any;
    switch (event.type) {
      case AgentStreamEventTypes.CHUNK:
        return `chunk:${data?.type}${event.outputProcessed ? ' (processed)' : ''}`;
      case AgentStreamEventTypes.SUSPENDED:
        return `suspended:${data?.type}:${data?.toolName}`;
      case AgentStreamEventTypes.ERROR:
        return `error:${data?.error?.name}`;
      case AgentStreamEventTypes.STEP_FINISH:
      case AgentStreamEventTypes.FINISH:
        return `${event.type}:${data?.stepResult?.reason}`;
      default:
        return event.type;
    }
  });
  return labels.filter((label, i) => label !== labels[i - 1]);
}

type Engine = 'durable' | 'evented';

type Scenario = Pick<RunLoopScenarioOptions, 'prompt' | 'fixtures' | 'requireToolApproval'> & {
  tools?: (abort: AbortController) => RunLoopScenarioOptions['tools'];
};

async function recordRun(getMock: () => any, engine: Engine, scenario: Scenario) {
  getMock().clearFixtures();
  getMock().resetMatchCounts();
  const pubsub = new RecordingPubSub();
  const abort = new AbortController();
  const { output } = await runLoopScenario({
    engine,
    llm: getMock(),
    pubsub,
    prompt: scenario.prompt,
    fixtures: scenario.fixtures,
    tools: scenario.tools?.(abort),
    abortSignal: abort.signal,
    errorProcessors: [],
    stopWhen: stepCountIs(5),
    ...(scenario.requireToolApproval !== undefined ? { requireToolApproval: scenario.requireToolApproval } : {}),
  });

  const topic = AGENT_STREAM_TOPIC(output.runId);
  await vi.waitFor(() => expect((pubsub.published.get(topic) ?? []).some(e => TERMINAL.has(e.type))).toBe(true));
  await pubsub.flush();
  const events = pubsub.published.get(topic)!;

  // Envelope invariants every reader relies on.
  for (const event of events) {
    expect(event.runId).toBe(output.runId);
    if (event.type === AgentStreamEventTypes.CHUNK) expect(typeof event.producedAt).toBe('number');
  }
  // Only this run's stream topic is published to.
  expect([...pubsub.published.keys()]).toEqual([topic]);

  pubsub.close();
  return describeEvents(events);
}

async function recordBothEngines(getMock: () => any, scenario: Scenario) {
  const durable = await recordRun(getMock, 'durable', scenario);
  const evented = await recordRun(getMock, 'evented', scenario);
  expect(evented).toEqual(durable);
  return durable;
}

const lookup = () =>
  createTool({
    id: 'lookup',
    description: 'Look something up',
    inputSchema: z.object({ q: z.string() }),
    outputSchema: z.object({ value: z.string() }),
    execute: async () => ({ value: 'FOUND' }),
  });

describe('agent stream events: default vs evented engine parity', () => {
  const getMock = useLoopScenarioAimock();

  it('text response', async () => {
    const events = await recordBothEngines(getMock, {
      prompt: 'Say hello.',
      fixtures: llm => llm.on({ endpoint: 'chat' }, { content: 'Hello there.' }),
    });
    expect(events).toMatchInlineSnapshot(`
      [
        "chunk:start",
        "step-start",
        "chunk:text-start",
        "chunk:text-delta",
        "chunk:text-end",
        "chunk:step-finish",
        "iteration-complete",
        "finish:stop",
      ]
    `);
  });

  it('tool call then text', async () => {
    const events = await recordBothEngines(getMock, {
      prompt: 'Look it up.',
      tools: () => ({ lookup: lookup() }),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_1', name: 'lookup', arguments: { q: 'x' } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'It is FOUND.' });
      },
    });
    expect(events).toMatchInlineSnapshot(`
      [
        "chunk:start",
        "step-start",
        "chunk:tool-call-input-streaming-start",
        "chunk:tool-call-delta",
        "chunk:tool-call-input-streaming-end",
        "chunk:tool-call",
        "chunk:tool-result",
        "chunk:step-finish",
        "iteration-complete",
        "step-start",
        "chunk:text-start",
        "chunk:text-delta",
        "chunk:text-end",
        "chunk:step-finish",
        "iteration-complete",
        "finish:stop",
      ]
    `);
  });

  it('tool approval suspends the run', async () => {
    const events = await recordBothEngines(getMock, {
      prompt: 'Look it up.',
      requireToolApproval: true,
      tools: () => ({ lookup: lookup() }),
      fixtures: llm =>
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_1', name: 'lookup', arguments: { q: 'x' } }] },
        ),
    });
    expect(events).toMatchInlineSnapshot(`
      [
        "chunk:start",
        "step-start",
        "chunk:tool-call-input-streaming-start",
        "chunk:tool-call-delta",
        "chunk:tool-call-input-streaming-end",
        "chunk:tool-call",
        "chunk:tool-call-approval",
        "suspended:approval:lookup",
      ]
    `);
  });

  it('provider error', async () => {
    const events = await recordBothEngines(getMock, {
      prompt: 'Fail please.',
      fixtures: llm =>
        llm.on(
          { endpoint: 'chat' },
          { error: { message: 'model exploded', type: 'invalid_request_error' }, status: 400 },
        ),
    });
    expect(events).toMatchInlineSnapshot(`
      [
        "chunk:start",
        "step-start",
        "chunk:error",
        "chunk:step-finish",
        "iteration-complete",
        "finish:error",
      ]
    `);
  });

  it('abort during a tool call', async () => {
    const events = await recordBothEngines(getMock, {
      prompt: 'Look it up then continue.',
      tools: abort => ({
        lookup: createTool({
          id: 'lookup',
          description: 'Look something up',
          inputSchema: z.object({ q: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: async () => {
            abort.abort();
            return { value: 'FOUND' };
          },
        }),
      }),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_1', name: 'lookup', arguments: { q: 'x' } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Should not be reached.' });
      },
    });
    expect(events).toMatchInlineSnapshot(`
      [
        "chunk:start",
        "step-start",
        "chunk:tool-call-input-streaming-start",
        "chunk:tool-call-delta",
        "chunk:tool-call-input-streaming-end",
        "chunk:tool-call",
        "chunk:tool-result",
        "chunk:step-finish",
        "finish:abort",
      ]
    `);
  });
});
