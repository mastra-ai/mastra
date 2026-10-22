/**
 * Ported from validation harness case T51 (sub-agent-suspend).
 * Source: 23f640a. A per-engine driver resumes the OUTER delegation and compares
 * the source's done(contract), not random child thread identities or diagnostics.
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

async function drive(engine: ParityEngine) {
  const events: string[] = [];
  const memory = new MockMemory();
  const workerModel = createRecordingModel({
    tapes: [
      toolCallTape('confirm', { amount: 42 }, 't51-confirm'),
      textOnlyTape('worker done {"confirmed":true,"amount":42}'),
    ],
  });
  const worker = new Agent({
    id: 't51-worker',
    name: 'worker',
    instructions: 'Confirm the payment.',
    model: workerModel.model,
    tools: {
      confirm: createTool({
        id: 'confirm',
        description: 'Confirm payment.',
        inputSchema: z.object({ amount: z.number() }),
        suspendSchema: z.object({ prompt: z.string() }),
        resumeSchema: z.object({ confirmed: z.boolean() }),
        execute: async ({ amount }, context) => {
          expect(amount).toBe(42);
          const data = context?.agent?.resumeData;
          events.push(data ? 'resumed' : 'start');
          if (!data) return context?.agent?.suspend?.({ prompt: `Pay ${amount}?` });
          expect(data).toEqual({ confirmed: true });
          if (data.confirmed) events.push('commit');
          return { confirmed: data.confirmed, amount };
        },
      }),
    },
  });
  const supervisorModel = createRecordingModel({
    tapes: [toolCallTape('agent-worker', { prompt: 'Pay 42.' }, 't51-outer'), textOnlyTape('delegated')],
  });
  const agent = new Agent({
    id: 't51-supervisor',
    name: 'supervisor',
    instructions: 'Delegate the payment.',
    model: supervisorModel.model,
    agents: { worker },
    memory,
  });
  const pubsub = new EventEmitterPubSub();
  const wrapper =
    engine === 'plain'
      ? undefined
      : engine === 'durable'
        ? createDurableAgent({ agent, pubsub })
        : createEventedAgent({ agent, pubsub });
  const host = new Mastra({ agents: { agent: wrapper ?? agent, worker }, storage: new InMemoryStore(), logger: false });
  const memoryOptions = { thread: 't51-thread', resource: 't51-resource' };
  const options = { memory: memoryOptions, runId: `t51-${engine}`, maxSteps: 6 };
  let cleanup: (() => void) | undefined;
  try {
    const initial = wrapper ? await wrapper.stream('Delegate the payment.', options) : undefined;
    cleanup = initial?.cleanup;
    const opening = initial?.output ?? (await agent.stream('Delegate the payment.', options));
    const mainTypes: string[] = [];
    let suspendedKeys: string[] | undefined;
    let suspendedToolName: string | undefined;
    let toolCallId: string | undefined;
    for await (const chunk of opening.fullStream) {
      mainTypes.push(chunk.type);
      if (chunk.type === 'tool-call-suspended') {
        toolCallId = chunk.payload.toolCallId;
        suspendedToolName = chunk.payload.toolName;
        suspendedKeys = Object.keys(chunk.payload).sort();
        expect(JSON.stringify(chunk.payload.suspendPayload)).toContain('Pay 42');
        break;
      }
    }
    expect(mainTypes).toContain('tool-call-suspended');
    expect(mainTypes.filter(type => ['error', 'abort', 'tripwire'].includes(type))).toEqual([]);
    expect(toolCallId).toBe('t51-outer');
    expect(suspendedToolName).toBe('agent-worker');
    expect(events).toEqual(['start']);
    const resumed = await (wrapper ?? agent).resumeStream({ confirmed: true }, { ...options, toolCallId });
    const resumedTypes: string[] = [];
    const delegations: unknown[] = [];
    for await (const chunk of resumed.fullStream) {
      resumedTypes.push(chunk.type);
      if (chunk.type === 'tool-result' && chunk.payload.toolName === 'agent-worker')
        delegations.push(chunk.payload.result);
    }
    expect(resumedTypes.filter(type => type === 'finish')).toHaveLength(1);
    expect(resumedTypes.filter(type => ['error', 'abort', 'tripwire'].includes(type))).toEqual([]);
    expect(events).toEqual(['start', 'resumed', 'commit']);
    expect(delegations).toHaveLength(1);
    const delegationText =
      typeof delegations[0] === 'string' ? delegations[0] : z.object({ text: z.string() }).parse(delegations[0]).text;
    expect(delegationText).toContain('worker done');
    expect(delegationText).toContain('"confirmed":true');
    expect(workerModel.requests).toHaveLength(2);
    expect(JSON.stringify(workerModel.requests[1]!.prompt)).toContain('confirmed');
    const { messages } = await memory.recall({ threadId: memoryOptions.thread, resourceId: memoryOptions.resource });
    const parts = messages
      .flatMap(message => message.content.parts ?? [])
      .filter(part => part.type === 'tool-invocation' && part.toolInvocation.toolName === 'agent-worker');
    expect(parts).toHaveLength(1);
    expect(parts[0]!.toolInvocation.state).toBe('result');
    return {
      suspendedToolName,
      suspendedKeys,
      confirmEvents: events,
      commits: events.filter(event => event === 'commit').length,
      parts: parts.map(part => part.toolInvocation.state),
    };
  } finally {
    cleanup?.();
    await host.shutdown({ drainTimeout: 1000 });
  }
}

describeParity('sub-agent-suspend parity', target => {
  it('resuming the outer delegation confirms and commits the worker payment exactly once', async () => {
    const plain = await drive('plain');
    expect(await drive(target)).toEqual(plain);
  }, 30_000);
});
