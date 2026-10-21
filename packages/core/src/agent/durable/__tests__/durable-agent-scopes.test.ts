import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import type { Processor } from '../../../processors';
import { MASTRA_SCOPES_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '../../../request-context';
import { MastraServerBase } from '../../../server/base';
import { InMemoryStore } from '../../../storage';
import { MockStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { resolveAgentScopes } from '../../scopes';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import { prepareForDurableExecution } from '../preparation';
import { globalRunRegistry } from '../run-registry';
import { restoreRequestContext } from '../utils/resolve-runtime';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

/** A server released before agent scopes: it does not set `reservesAgentScopes`. */
class OutdatedServer extends MastraServerBase {}

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
    // The persisted entries record the (empty) scope set unconditionally so a cold resume
    // can distinguish a scopeless run from a pre-upgrade snapshot.
    expect(result.workflowInput.requestContextEntries?.[MASTRA_SCOPES_KEY]).toEqual([]);
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

  it('stream refuses caller scopes behind an outdated server but keeps the Agent scopes', async () => {
    const { agent, seen } = build({ scopes: ['team:core'] });
    const mastra = new Mastra({ logger: false, storage: new MockStore(), agents: { scopedAgent: agent } });
    mastra.setMastraServer(new OutdatedServer({ app: {} }));
    await expect(agent.stream('hello', { scopes: ['org:victim'] })).rejects.toMatchObject({
      id: 'AGENT_SCOPES_SERVER_OUTDATED',
    });
    const requestContext = new RequestContext([[MASTRA_SCOPES_KEY, ['org:victim']]]);
    await expect(agent.stream('hello', { requestContext })).rejects.toMatchObject({
      id: 'AGENT_SCOPES_SERVER_OUTDATED',
    });
    const { output, cleanup } = await agent.stream('hello');
    await output.consumeStream();
    cleanup();
    expect(seen).toEqual([['team:core']]);
  });

  it('stream throws a 400 conflict when scopes and memory disagree', async () => {
    const { agent } = build();
    await expect(
      agent.stream('hello', { scopes: ['thread:a'], memory: { thread: 'b', resource: 'u1' } }),
    ).rejects.toMatchObject({ id: 'AGENT_SCOPES_CONFLICT', details: { status: 400 } });
  });

  /** An agent whose first model call asks for an approved tool. A resumed process skips that call. */
  function approvalAgent(config: Partial<ConstructorParameters<typeof Agent>[0]> = {}, resumedProcess = false) {
    let calls = resumedProcess ? 1 : 0;
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
    const { agent } = build({ model: model as LanguageModelV2, tools: { approve }, ...config });
    return { agent, toolSeen };
  }

  async function suspendForApproval(
    scopes: string[],
    config: Partial<ConstructorParameters<typeof Agent>[0]> = {},
    storage = new MockStore(),
  ) {
    const { agent, toolSeen } = approvalAgent(config);
    new Mastra({ logger: false, storage, agents: { scopedAgent: agent } });
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

  it('resume never writes the suspended run scopes onto the caller context', async () => {
    const { agent, initial, toolSeen } = await suspendForApproval(['org:a', 'resource:u1', 'thread:t1']);
    const callerContext = new RequestContext();
    let finished = false;
    const resumed = await agent.resume(
      initial.runId,
      { approved: true },
      {
        requestContext: callerContext,
        onFinish: () => {
          finished = true;
        },
      },
    );
    await vi.waitFor(() => expect(finished).toBe(true));
    expect(toolSeen).toEqual([['org:a']]);
    expect(callerContext.has(MASTRA_SCOPES_KEY)).toBe(false);
    resumed.cleanup();
    initial.cleanup();
  });

  it('resumes a run that started without scopes after the Agent gains a scopes resolver', async () => {
    let configured: string[] = [];
    let resolverCalls = 0;
    const { agent, initial, toolSeen } = await suspendForApproval([], {
      scopes: () => {
        resolverCalls++;
        return configured;
      },
    });
    configured = ['org:local'];
    const callsBeforeResume = resolverCalls;
    let finished = false;
    const resumed = await agent.resume(
      initial.runId,
      { approved: true },
      {
        onFinish: () => {
          finished = true;
        },
      },
    );
    await vi.waitFor(() => expect(finished).toBe(true));
    expect(toolSeen).toEqual([undefined]);
    expect(resolverCalls).toBe(callsBeforeResume);
    resumed.cleanup();
    initial.cleanup();
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

  /** Suspends a run, drops process-local state, and resumes it from storage with a new agent instance. */
  async function resumeOnFreshProcess(
    scopes: string[],
    {
      first = {},
      second = {},
      outdatedServer = false,
      requestContext,
    }: {
      first?: Partial<ConstructorParameters<typeof Agent>[0]>;
      second?: Partial<ConstructorParameters<typeof Agent>[0]>;
      outdatedServer?: boolean;
      requestContext?: RequestContext;
    } = {},
  ) {
    const storage = new MockStore();
    const memory = new MockMemory({ storage: new InMemoryStore() });
    const { initial } = await suspendForApproval(scopes, { ...first, memory }, storage);
    initial.cleanup();
    globalRunRegistry.clear();

    const { agent, toolSeen } = approvalAgent({ ...second, memory }, true);
    const mastra = new Mastra({ logger: false, storage, agents: { scopedAgent: agent } });
    if (outdatedServer) mastra.setMastraServer(new OutdatedServer({ app: {} }));
    let finished = false;
    const resumed = await agent.resume(
      initial.runId,
      { approved: true },
      {
        requestContext,
        onFinish: () => {
          finished = true;
        },
      },
    );
    await vi.waitFor(() => expect(finished).toBe(true));
    resumed.cleanup();
    return toolSeen;
  }

  it('resume on a fresh process keeps the persisted scopes', async () => {
    expect(await resumeOnFreshProcess(['org:a', 'resource:u1', 'thread:t1', 'team:core'])).toEqual([
      ['org:a', 'team:core'],
    ]);
  });

  it('resume on a fresh process keeps the persisted scopes when the caller passes its own context', async () => {
    const requestContext = new RequestContext();
    expect(await resumeOnFreshProcess(['org:a', 'resource:u1', 'thread:t1'], { requestContext })).toEqual([['org:a']]);
    expect(requestContext.has(MASTRA_SCOPES_KEY)).toBe(false);
  });

  it('resume on a fresh process does not consult a changed Agent resolver', async () => {
    const toolSeen = await resumeOnFreshProcess(['resource:u1', 'thread:t1'], {
      first: { scopes: ['org:a'] },
      second: { scopes: ['org:b'] },
    });
    expect(toolSeen).toEqual([['org:a']]);
  });

  it('resume on a fresh process behind an outdated server keeps the Agent scopes the run started with', async () => {
    const toolSeen = await resumeOnFreshProcess(['resource:u1', 'thread:t1'], {
      first: { scopes: ['org:a'] },
      second: { scopes: ['org:a'] },
      outdatedServer: true,
    });
    expect(toolSeen).toEqual([['org:a']]);
  });
});

describe('restoreRequestContext', () => {
  const outdated = { getMastraServer: () => new OutdatedServer({ app: {} }) };

  it('restores persisted run scopes as Core-written, unlike a context built from the same JSON', () => {
    const entries = JSON.parse(JSON.stringify({ [MASTRA_SCOPES_KEY]: ['org:a'] })) as Record<string, unknown>;
    const restored = restoreRequestContext(entries);
    expect(restored.get(MASTRA_SCOPES_KEY)).toEqual(['org:a']);
    expect(() => resolveAgentScopes({ requestContext: restored, mastra: outdated })).not.toThrow();
    expect(() =>
      resolveAgentScopes({ requestContext: new RequestContext(Object.entries(entries)), mastra: outdated }),
    ).toThrow(expect.objectContaining({ id: 'AGENT_SCOPES_SERVER_OUTDATED' }));
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

  it('refuses caller scopes behind an outdated server', async () => {
    const mastra = new Mastra({ logger: false });
    mastra.setMastraServer(new OutdatedServer({ app: {} }));
    await expect(
      prepareForDurableExecution({
        agent: baseAgent(),
        messages: 'hi',
        options: { scopes: ['org:victim'] },
        optionsAreResolved: true,
        mastra,
      }),
    ).rejects.toMatchObject({ id: 'AGENT_SCOPES_SERVER_OUTDATED' });
  });

  it('does not treat Agent default scopes merged into the options as caller scopes', async () => {
    const mastra = new Mastra({ logger: false });
    mastra.setMastraServer(new OutdatedServer({ app: {} }));
    const preparation = await prepareForDurableExecution({
      agent: baseAgent({ defaultOptions: { scopes: ['team:core'] } }),
      messages: 'hi',
      // As the Inngest agent passes them: the call options with the Agent defaults merged in.
      options: { scopes: ['team:core'] },
      optionsAreResolved: true,
      callScopes: undefined,
      mastra,
    });
    expect(preparation.workflowInput.requestContextEntries?.[MASTRA_SCOPES_KEY]).toEqual(['team:core']);
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
    expect(preparation.workflowInput.requestContextEntries?.[MASTRA_SCOPES_KEY]).toEqual([]);
  });
});
