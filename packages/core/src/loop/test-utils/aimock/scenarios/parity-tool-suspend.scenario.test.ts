/**
 * Ported from validation harness case T13 (tool-suspend).
 * Source: 23f640a. Driven per engine to observe the suspension before any side effect
 * and resume batches without a toolCallId; shared parity helpers merge segments.
 * Restart cells belong to COR-1449.
 */
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { createDurableAgent } from '../../../../agent/durable/create-durable-agent';
import { createEventedAgent } from '../../../../agent/durable/create-evented-agent';
import { EventEmitterPubSub } from '../../../../events/event-emitter';
import { Mastra } from '../../../../mastra';
import { MockMemory } from '../../../../memory/mock';
import { InMemoryStore } from '../../../../storage/mock';
import { createTool } from '../../../../tools';
import type { ParityEngine } from '../parity';
import { createRecordingModel, describeParity, textOnlyTape, toolCallTape } from '../parity';

type Variant = 'yes' | 'no' | 'batch';

async function drive(engine: ParityEngine, variant: Variant) {
  const amounts = variant === 'batch' ? [1, 2, 3] : [42];
  const log: { event: 'start' | 'resumed' | 'commit'; amount: number }[] = [];
  const memory = new MockMemory();
  const first = toolCallTape('confirm', { amount: amounts[0] }, 't13-1');
  const { model } = createRecordingModel({
    tapes: [
      [
        ...first.filter(chunk => chunk.type !== 'tool-call' && chunk.type !== 'finish'),
        ...amounts.flatMap((amount, index) =>
          toolCallTape('confirm', { amount }, `t13-${index + 1}`).filter(chunk => chunk.type === 'tool-call'),
        ),
        ...first.filter(chunk => chunk.type === 'finish'),
      ],
      textOnlyTape('answered'),
    ],
  });
  const agent = new Agent({
    id: 't13-agent',
    name: 'T13 Agent',
    instructions: 'Confirm payments before committing.',
    model,
    memory,
    tools: {
      confirm: createTool({
        id: 'confirm',
        description: 'Confirm a payment.',
        inputSchema: z.object({ amount: z.number() }),
        suspendSchema: z.object({ prompt: z.string() }),
        resumeSchema: z.object({ confirmed: z.boolean() }),
        execute: async ({ amount }, context) => {
          const resumeData = context?.agent?.resumeData;
          log.push({ event: resumeData ? 'resumed' : 'start', amount });
          if (!resumeData) return context?.agent?.suspend?.({ prompt: `Pay ${amount}?` });
          if (resumeData.confirmed) log.push({ event: 'commit', amount });
          return { confirmed: resumeData.confirmed, amount };
        },
      }),
    },
  });
  const pubsub = new EventEmitterPubSub();
  const wrapper =
    engine === 'plain'
      ? undefined
      : engine === 'durable'
        ? createDurableAgent({ agent, pubsub })
        : createEventedAgent({ agent, pubsub });
  const host = new Mastra({ agents: { agent: wrapper ?? agent }, storage: new InMemoryStore(), logger: false });
  const memoryOptions = { thread: 't13-thread', resource: 't13-resource' };
  const options = { memory: memoryOptions, runId: `t13-${engine}-${variant}`, maxSteps: 4 };
  const runner = wrapper ?? agent;
  let cleanup: (() => void) | undefined;
  try {
    const initial = wrapper ? await wrapper.stream('Confirm payments.', options) : undefined;
    cleanup = initial?.cleanup;
    const opening = initial?.output ?? (await agent.stream('Confirm payments.', options));
    const mainTypes: string[] = [];
    let toolCallId: string | undefined;
    for await (const chunk of opening.fullStream) {
      mainTypes.push(chunk.type);
      if (chunk.type === 'tool-call-suspended') {
        toolCallId = chunk.payload.toolCallId;
        break;
      }
    }
    expect(toolCallId).toBe('t13-1');
    expect(mainTypes).not.toContain('error');
    expect(log.filter(entry => entry.event === 'commit')).toEqual([]);
    const resumedTypes: string[] = [];
    const results: unknown[] = [];
    let suspended = true;
    for (let round = 0; suspended && round < amounts.length + 1; round++) {
      suspended = false;
      const output = await runner.resumeStream(
        { confirmed: variant !== 'no' },
        {
          ...options,
          ...(variant === 'batch' ? {} : { toolCallId }),
        },
      );
      for await (const chunk of output.fullStream) {
        resumedTypes.push(chunk.type);
        if (chunk.type === 'tool-result' && chunk.payload.toolName === 'confirm') results.push(chunk.payload.result);
        if (chunk.type === 'tool-call-suspended') {
          suspended = true;
          break;
        }
      }
    }
    expect(suspended).toBe(false);
    expect(resumedTypes.filter(type => type === 'finish')).toHaveLength(1);
    expect(resumedTypes.filter(type => ['error', 'abort', 'tripwire'].includes(type))).toEqual([]);
    const logged = (event: 'start' | 'resumed' | 'commit') =>
      log
        .filter(entry => entry.event === event)
        .map(entry => entry.amount)
        .sort((a, b) => a - b);
    expect(logged('resumed')).toEqual(amounts);
    expect(logged('commit')).toEqual(variant === 'no' ? [] : amounts);
    if (variant !== 'batch') {
      expect(logged('start')).toEqual([42]);
      expect(results).toEqual([{ confirmed: variant === 'yes', amount: 42 }]);
    }
    const { messages } = await memory.recall({ threadId: memoryOptions.thread, resourceId: memoryOptions.resource });
    const parts = messages
      .flatMap(message => message.content.parts ?? [])
      .filter(part => part.type === 'tool-invocation' && part.toolInvocation.toolName === 'confirm');
    expect(parts).toHaveLength(amounts.length);
    expect(parts.map(part => part.toolInvocation.state)).toEqual(amounts.map(() => 'result'));
    return {
      variant,
      ...(variant === 'batch' ? { log: log.map(entry => `${entry.event}:${entry.amount}`) } : { mainTypes }),
      resumedTypes,
      resumed: logged('resumed'),
      committed: logged('commit'),
      results,
      states: parts.map(part => part.toolInvocation.state),
    };
  } finally {
    cleanup?.();
    await host.shutdown({ drainTimeout: 1000 });
  }
}

describeParity('tool-suspend parity', target => {
  it.each(['yes', 'no', 'batch'] as const)(
    '%s: resumed payments commit exactly once and persist results',
    async variant => {
      const plain = await drive('plain', variant);
      const actual = await drive(target, variant);
      if (variant === 'batch') {
        // COR-1344: plain buffers results behind the foreach barrier; wrapped
        // engines emit each result before the next sibling suspends.
        expect(plain.resumedTypes.slice(0, 8)).toEqual([
          'tool-call-resumed',
          'tool-call-suspended',
          'tool-call-resumed',
          'tool-call-suspended',
          'tool-call-resumed',
          'tool-result',
          'tool-result',
          'tool-result',
        ]);
        const expected = structuredClone(plain);
        expected.resumedTypes.splice(
          0,
          8,
          'tool-call-resumed',
          'tool-result',
          'tool-call-suspended',
          'tool-call-resumed',
          'tool-result',
          'tool-call-suspended',
          'tool-call-resumed',
          'tool-result',
        );
        expect(actual.resumedTypes).not.toEqual(plain.resumedTypes);
        expect(actual).toEqual(expected);
      } else {
        expect(actual).toEqual(plain);
      }
    },
    30_000,
  );
});
