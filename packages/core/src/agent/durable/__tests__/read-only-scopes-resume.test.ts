import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Knowledge } from '../../../knowledge';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { MockStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { getRunAgentScopes } from '../../scopes';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import { globalRunRegistry } from '../run-registry';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function approvalModel() {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      const parts =
        calls === 1
          ? [
              { type: 'tool-call', toolCallId: 'c1', toolName: 'approve', input: '{}' },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ]
          : calls === 2
            ? [
                {
                  type: 'tool-call',
                  toolCallId: 'c2',
                  toolName: 'knowledge_create',
                  input: JSON.stringify({
                    name: 'Team note',
                    kind: 'note',
                    text: 'Team ships Tuesdays.',
                    scope: ['team:core'],
                  }),
                },
                {
                  type: 'tool-call',
                  toolCallId: 'c3',
                  toolName: 'knowledge_create',
                  input: JSON.stringify({
                    name: 'Org note',
                    kind: 'note',
                    text: 'Org ships Fridays.',
                    scope: ['org:a'],
                  }),
                },
                { type: 'finish', finishReason: 'tool-calls', usage },
              ]
            : [
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: 'done' },
                { type: 'text-end', id: 't' },
                { type: 'finish', finishReason: 'stop', usage },
              ];
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...parts] as any),
      };
    },
  });
}

describe.each([
  ['plain', null],
  ['durable', createDurableAgent],
  ['evented', createEventedAgent],
] as const)('%s agent: read-only scope tags across an approval resume', (kind, createAgent) => {
  const pubsub = new EventEmitterPubSub();
  afterEach(() => globalRunRegistry.clear());

  it('keeps a read-only tag read-only after approval, so Knowledge writes naming it are refused', async () => {
    const knowledge = new Knowledge({ id: `k-${kind}`, storage: new InMemoryStore(), tools: { write: true } });
    const store = await knowledge.getStorage();
    const created = vi.spyOn(store, 'createNode');
    let onResume: unknown;
    const approve = createTool({
      id: 'approve',
      description: 'needs approval',
      inputSchema: z.object({}),
      requireApproval: true,
      execute: async (_input, ctx) => {
        onResume = getRunAgentScopes(ctx.requestContext);
        return { ok: true };
      },
    });
    const base = new Agent({
      id: `read-only-${kind}`,
      name: 'read-only',
      instructions: 'test',
      model: approvalModel() as LanguageModelV2,
      memory: new MockMemory({ storage: new InMemoryStore() }),
      tools: { approve },
      knowledge,
    } as any);
    const agent: any = createAgent ? createAgent({ agent: base, pubsub }) : base;
    new Mastra({
      logger: false,
      storage: new MockStore(),
      agents: { a: agent },
      knowledge: { [`k-${kind}`]: knowledge },
    } as any);

    let suspended: unknown;
    const initial = await agent.stream('go', {
      scopes: [{ tag: 'org:a', access: 'read' }, 'team:core', 'resource:u1', 'thread:t1'],
      onSuspended: (data: unknown) => (suspended = data),
    });
    if (!createAgent) for await (const _ of initial.fullStream);
    await vi.waitFor(() => expect(suspended ?? initial.status === 'suspended').toBeTruthy(), { timeout: 5000 });

    let finished = false;
    const resumed = createAgent
      ? await agent.resume(initial.runId, { approved: true }, { onFinish: () => (finished = true) })
      : await agent.approveToolCall({ runId: initial.runId, toolCallId: 'c1' });
    if (!createAgent) {
      for await (const _ of resumed.fullStream);
      finished = true;
    }
    await vi.waitFor(() => expect(finished).toBe(true), { timeout: 5000 });

    expect(onResume).toContainEqual({ tag: 'org:a', access: 'read' });
    expect(onResume).toContainEqual({ tag: 'team:core', access: 'readwrite' });
    await vi.waitFor(() => expect(created.mock.calls.map(([input]) => input.name)).toEqual(['Team note']), {
      timeout: 5000,
    });
  });
});
