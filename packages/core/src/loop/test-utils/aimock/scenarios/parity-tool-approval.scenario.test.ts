/**
 * Ported from validation harness case T6 (tool-approval), source 23f640a.
 * Driven per engine because expectParity merges the opening and resumed streams:
 * it cannot assert that no side effect occurred before surfacing the approval,
 * or pass the source's decline reason. Shared helpers remain unchanged.
 * Restarting while suspended belongs to COR-1449.
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

const EDITED = { approved: true, note: 'edited-in-approval-ui' };
const MEMORY = { thread: 't6-thread', resource: 't6-resource' };
type Variant = 'approve' | 'deny' | 'approve-edited';

async function drive(engine: ParityEngine, variant: Variant) {
  const starts: unknown[] = [];
  const commits: number[] = [];
  const memory = new MockMemory();
  const { model } = createRecordingModel({
    tapes: [toolCallTape('transfer', { amount: 42 }, 't6-transfer'), textOnlyTape('TX-42')],
  });
  const agent = new Agent({
    id: 't6-agent',
    name: 'T6 Agent',
    instructions: 'Transfer only after approval.',
    model,
    memory,
    tools: {
      transfer: createTool({
        id: 'transfer',
        description: 'Transfer the requested amount.',
        requireApproval: true,
        inputSchema: z.object({ amount: z.number() }),
        execute: async ({ amount }, context) => {
          starts.push(context?.agent?.resumeData);
          commits.push(amount);
          return { transferred: amount, confirmation: `TX-${amount}` };
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
  const options = { maxSteps: 5, memory: MEMORY, runId: `t6-${engine}-${variant}` };
  const cleanups: (() => void)[] = [];
  try {
    const initial = wrapper ? await wrapper.stream('Transfer 42.', options) : undefined;
    if (initial) cleanups.push(initial.cleanup);
    const opening = initial?.output ?? (await agent.stream('Transfer 42.', options));
    const initialTypes: string[] = [];
    let toolCallId: string | undefined;
    for await (const chunk of opening.fullStream) {
      initialTypes.push(chunk.type);
      if (chunk.type === 'tool-call-approval') {
        toolCallId = chunk.payload.toolCallId;
        expect(starts).toEqual([]);
        expect(commits).toEqual([]);
        break;
      }
    }
    expect(toolCallId).toBe('t6-transfer');
    expect(initialTypes.filter(type => type === 'error')).toEqual([]);
    const runner = wrapper ?? agent;
    const resumeOptions = { ...options, toolCallId: toolCallId! };
    const resumed =
      variant === 'deny'
        ? await runner.declineToolCall({ ...resumeOptions, reason: 'not authorized' })
        : variant === 'approve'
          ? await runner.approveToolCall(resumeOptions)
          : await runner.resumeStream(EDITED, resumeOptions);
    const resumedTypes: string[] = [];
    let text = '';
    for await (const chunk of resumed.fullStream) {
      resumedTypes.push(chunk.type);
      if (chunk.type === 'text-delta') text += chunk.payload.text;
    }
    expect(resumedTypes.filter(type => type === 'finish').length).toBeGreaterThanOrEqual(1);
    expect(resumedTypes.filter(type => type === 'error')).toEqual([]);
    expect(commits).toEqual(variant === 'deny' ? [] : [42]);
    if (variant === 'approve-edited') expect(starts).toEqual([EDITED]);
    if (variant === 'approve') {
      expect(resumedTypes.filter(type => type === 'tool-result')).toHaveLength(1);
      expect(text).toMatch(/TX-42|42/);
    }
    const { messages } = await memory.recall({ threadId: MEMORY.thread, resourceId: MEMORY.resource });
    expect(messages.filter(message => message.role === 'user')).toHaveLength(1);
    const parts = messages
      .flatMap(message => message.content.parts ?? [])
      .filter(part => part.type === 'tool-invocation' && part.toolInvocation.toolName === 'transfer');
    expect(parts).toHaveLength(1);
    expect(parts[0]!.toolInvocation.state).toBe(variant === 'deny' ? 'output-denied' : 'result');
    return {
      commits,
      initialApprovalCount: initialTypes.filter(type => type === 'tool-call-approval').length,
      finishes: resumedTypes.filter(type => type === 'finish').length,
      errors: resumedTypes.filter(type => type === 'error').length,
      state: parts[0]!.toolInvocation.state,
    };
  } finally {
    for (const cleanup of cleanups) cleanup();
    await host.shutdown({ drainTimeout: 1000 });
  }
}

describeParity('tool-approval parity', target => {
  it.each(['approve', 'deny', 'approve-edited'] as const)(
    '%s: transfer executes only after the decision',
    async variant => {
      const plain = await drive('plain', variant);
      expect(await drive(target, variant)).toEqual(plain);
    },
    30_000,
  );
});
