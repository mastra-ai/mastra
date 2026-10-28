/**
 * AIMock Scenario: a background task dispatched over a bus with delivery latency
 *
 * A dispatched background task stays `pending` until a worker takes it off the
 * bus. The background-task check used to look for `running` tasks only, so on
 * a bus with delivery latency (a socket or broker pubsub) a deferred task that
 * was still in flight looked like no task at all: the durable loop ended
 * without waiting and its stream never got the task's result.
 *
 * Plain never waits for the task, so its turn ends with the dispatch still in
 * flight; the parity harness has to let the task settle before it shuts the
 * host down, or the task never runs.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../../../agent';
import { EventEmitterPubSub } from '../../../../events/event-emitter';
import { createTool } from '../../../../tools';
import { delay } from '../../../../utils';
import type { EngineParityScenario } from '../parity';
import { describeParity, runOnEngine, textOnlyTape, toolCallTape } from '../parity';

/** Delivers background-task dispatches to workers late, as a bus with real delivery latency does. */
class SlowDispatchPubSub extends EventEmitterPubSub {
  override async publish(...args: Parameters<EventEmitterPubSub['publish']>) {
    const [topic, event] = args;
    if (!topic.startsWith('background-tasks') || event.type !== 'task.dispatch') return super.publish(...args);
    // The publish is accepted at once; the worker gets it 100ms later.
    void delay(100).then(() => super.publish(...args));
  }
}

function slowDispatchScenario(executions: { count: number }): EngineParityScenario {
  return {
    name: 'slow-dispatch',
    model: { tapes: [toolCallTape('research', { topic: 'AI' }), textOnlyTape('Done.')] },
    buildAgent: ({ model }) =>
      new Agent({
        id: 'slow-dispatch',
        name: 'Slow Dispatch',
        instructions: 'Be brief',
        model,
        tools: {
          research: createTool({
            id: 'research',
            description: 'Research a topic',
            inputSchema: z.object({ topic: z.string() }),
            execute: async ({ topic }) => {
              executions.count++;
              return { summary: `Research on ${topic}` };
            },
            background: { enabled: true },
          }),
        },
        backgroundTasks: { tools: { research: true } },
      }),
    input: 'Research AI',
    options: { maxSteps: 3 },
    host: { pubsub: new SlowDispatchPubSub(), backgroundTasks: { enabled: true } },
  };
}

describe('background task dispatched over a slow bus [plain]', () => {
  it('still runs the task the turn left in flight', async () => {
    const executions = { count: 0 };
    const result = await runOnEngine('plain', slowDispatchScenario(executions));

    const turn = result.turns[0]!;
    expect(turn.chunkTypes).toContain('background-task-started');
    expect(turn.toolResults[0]!.result).toEqual(expect.stringContaining('running in the background'));
    expect(executions.count).toBe(1);
  });
});

describeParity('background task dispatched over a slow bus', engine => {
  it('waits for the in-flight task and streams its result', async () => {
    const executions = { count: 0 };
    const result = await runOnEngine(engine, slowDispatchScenario(executions));

    const turn = result.turns[0]!;
    expect(executions.count).toBe(1);
    expect(turn.chunkTypes).toContain('background-task-progress');
    expect(turn.toolResults).toEqual([
      expect.objectContaining({ toolName: 'research', result: { summary: 'Research on AI' } }),
    ]);
  });
});
