import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import type { Processor } from '../../../processors';
import { MASTRA_SCOPES_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '../../../request-context';
import { InMemoryStore } from '../../../storage';
import { MockStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import { prepareForDurableExecution } from '../preparation';
import { globalRunRegistry } from '../run-registry';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function textModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'ok' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage },
      ]),
    }),
  });
}

describe.each([
  ['durable', createDurableAgent],
  ['evented', createEventedAgent],
] as const)('%s agent scopes', (kind, createAgent) => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    globalRunRegistry.clear();
    await pubsub.close();
  });

  function build(config: Partial<ConstructorParameters<typeof Agent>[0]> = {}) {
    const seen: unknown[] = [];
    const recorder: Processor = {
      id: 'scope-recorder',
      processInput: async ({ messages, requestContext }) => {
        seen.push(requestContext?.get(MASTRA_SCOPES_KEY));
        return messages;
      },
    };
    const memory = new MockMemory({ storage: new InMemoryStore() });
    const baseAgent = new Agent({
      id: `scoped-${kind}`,
      name: `Scoped ${kind}`,
      instructions: 'Test',
      model: textModel() as LanguageModelV2,
      memory,
      inputProcessors: [recorder],
      ...config,
    } as ConstructorParameters<typeof Agent>[0]);
    return { agent: createAgent({ agent: baseAgent, pubsub }), memory, seen };
  }

  it('prepare resolves memory identity from scopes and snapshots only non-identity scopes', async () => {
    const { agent } = build();
    const requestContext = new RequestContext();
    const result = await agent.prepare('hello', {
      requestContext,
      scopes: ['org:acme', 'resource:u1', 'thread:t1'],
    });
    expect(result.threadId).toBe('t1');
    expect(result.resourceId).toBe('u1');
    expect(result.workflowInput.requestContextEntries?.[MASTRA_SCOPES_KEY]).toEqual(['org:acme']);
    expect(requestContext.has(MASTRA_SCOPES_KEY)).toBe(false);
  });

  it('prepare without scopes keeps reading memory options only', async () => {
    const { agent } = build();
    const requestContext = new RequestContext([[MASTRA_THREAD_ID_KEY, 'middleware-thread']]);
    const result = await agent.prepare('hello', { requestContext });
    expect(result.threadId).toBeUndefined();
    expect(result.workflowInput.requestContextEntries?.[MASTRA_SCOPES_KEY]).toBeUndefined();
  });

  it('stream applies the Agent resolver and reserved key scopes', async () => {
    const { agent, memory, seen } = build({ scopes: ['team:core'] });
    const requestContext = new RequestContext([[MASTRA_SCOPES_KEY, ['org:acme', 'resource:u1', 'thread:t1']]]);
    const { output, cleanup } = await agent.stream('hello', { requestContext });
    await output.consumeStream();
    cleanup();
    expect(seen).toEqual([['org:acme', 'team:core']]);
    expect((await memory.getThreadById({ threadId: 't1' }))?.resourceId).toBe('u1');
  });

  it('stream throws a 400 conflict when scopes and memory disagree', async () => {
    const { agent } = build();
    await expect(
      agent.stream('hello', { scopes: ['thread:a'], memory: { thread: 'b', resource: 'u1' } }),
    ).rejects.toMatchObject({ id: 'AGENT_SCOPES_CONFLICT', details: { status: 400 } });
  });

  async function suspendForApproval(scopes: string[]) {
    let calls = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        calls++;
        const parts =
          calls === 1
            ? [
                { type: 'tool-call', toolCallId: 'call-1', toolName: 'approve', input: '{}' },
                { type: 'finish', finishReason: 'tool-calls', usage },
              ]
            : [
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'done' },
                { type: 'text-end', id: 'text-1' },
                { type: 'finish', finishReason: 'stop', usage },
              ];
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...parts] as any),
        };
      },
    });
    const toolSeen: unknown[] = [];
    const approve = createTool({
      id: 'approve',
      description: 'needs approval',
      inputSchema: z.object({}),
      requireApproval: true,
      execute: async (_input, context) => {
        toolSeen.push(context.requestContext?.get(MASTRA_SCOPES_KEY));
        return { ok: true };
      },
    });
    const { agent } = build({ model: model as LanguageModelV2, tools: { approve } });
    new Mastra({ logger: false, storage: new MockStore(), agents: { scopedAgent: agent } });
    let suspended: unknown;
    const initial = await agent.stream('go', { scopes, onSuspended: data => (suspended = data) });
    await vi.waitFor(() => expect(suspended).toBeDefined());
    return { agent, initial, toolSeen };
  }

  it('resume keeps the suspended run scopes and accepts a subset from middleware', async () => {
    const { agent, initial, toolSeen } = await suspendForApproval(['org:a', 'resource:u1', 'thread:t1', 'team:core']);
    let finished = false;
    const resumed = await agent.resume(
      initial.runId,
      { approved: true },
      {
        requestContext: new RequestContext([[MASTRA_SCOPES_KEY, ['org:a']]]),
        onFinish: () => {
          finished = true;
        },
      },
    );
    await vi.waitFor(() => expect(finished).toBe(true));
    expect(toolSeen).toEqual([['org:a', 'team:core']]);
    resumed.cleanup();
    initial.cleanup();
  });

  it('resume rejects a scope the suspended run did not hold', async () => {
    const { agent, initial } = await suspendForApproval(['org:a', 'resource:u1', 'thread:t1']);
    await expect(
      agent.resume(
        initial.runId,
        { approved: true },
        { requestContext: new RequestContext([[MASTRA_SCOPES_KEY, ['org:b']]]) },
      ),
    ).rejects.toMatchObject({ id: 'AGENT_SCOPES_CONFLICT' });
    initial.cleanup();
  });

  it('prepare without options applies Agent and default scopes', async () => {
    const { agent } = build({ scopes: ['resource:u1'], defaultOptions: { scopes: ['thread:t1', 'team:core'] } });
    const preparation = await agent.prepare('hi');
    expect(preparation.threadId).toBe('t1');
    expect(preparation.resourceId).toBe('u1');
    expect(preparation.workflowInput.requestContextEntries?.[MASTRA_SCOPES_KEY]).toEqual(['team:core']);
  });

  it('resume rejects scopes added to a run that started without any', async () => {
    const { agent, initial } = await suspendForApproval([]);
    await expect(
      agent.resume(
        initial.runId,
        { approved: true },
        { requestContext: new RequestContext([[MASTRA_SCOPES_KEY, ['org:x']]]) },
      ),
    ).rejects.toMatchObject({ id: 'AGENT_SCOPES_CONFLICT' });
    initial.cleanup();
  });
});

describe('prepareForDurableExecution scopes', () => {
  function baseAgent(config: Partial<ConstructorParameters<typeof Agent>[0]> = {}) {
    return new Agent({
      id: 'prep-agent',
      name: 'Prep Agent',
      instructions: 'Test',
      model: textModel() as LanguageModelV2,
      memory: new MockMemory({ storage: new InMemoryStore() }),
      ...config,
    } as ConstructorParameters<typeof Agent>[0]);
  }

  it('resolves scopes for callers that did not, such as the Inngest agent', async () => {
    const callerContext = new RequestContext([[MASTRA_SCOPES_KEY, ['org:acme']]]);
    const preparation = await prepareForDurableExecution({
      agent: baseAgent({ scopes: ['team:core'] }),
      messages: 'hi',
      options: { scopes: ['resource:u1', 'thread:t1'] },
      optionsAreResolved: true,
      requestContext: callerContext,
    });
    expect(preparation.threadId).toBe('t1');
    expect(preparation.resourceId).toBe('u1');
    expect(preparation.workflowInput.requestContextEntries?.[MASTRA_SCOPES_KEY]).toEqual(['org:acme', 'team:core']);
    expect(callerContext.get(MASTRA_SCOPES_KEY)).toEqual(['org:acme']);
  });

  it('throws on conflicting identity and leaves options unchanged without scopes', async () => {
    await expect(
      prepareForDurableExecution({
        agent: baseAgent(),
        messages: 'hi',
        options: { scopes: ['thread:a'], memory: { thread: 'b', resource: 'u1' } },
        optionsAreResolved: true,
      }),
    ).rejects.toMatchObject({ id: 'AGENT_SCOPES_CONFLICT' });

    const requestContext = new RequestContext([[MASTRA_THREAD_ID_KEY, 'ignored']]);
    const preparation = await prepareForDurableExecution({
      agent: baseAgent(),
      messages: 'hi',
      options: { memory: { thread: 't2', resource: 'u2' } },
      optionsAreResolved: true,
      requestContext,
    });
    expect(preparation.threadId).toBe('t2');
    expect(preparation.workflowInput.requestContextEntries?.[MASTRA_SCOPES_KEY]).toBeUndefined();
  });
});
