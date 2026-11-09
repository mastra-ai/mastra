import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { MASTRA_NORMALIZED_USER_KEY, RequestContext } from '../../../request-context';
import { InMemoryStore } from '../../../storage';
import { MockStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import { globalRunRegistry } from '../run-registry';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const alice = { id: 'alice', role: 'admin' };
const bob = { id: 'bob', role: 'member' };

// Keys the server auth middleware sets for an authenticated request.
const USER_KEYS = [
  MASTRA_NORMALIZED_USER_KEY,
  'mastra__user',
  'mastra__userRoles',
  'mastra__userPermissions',
  'user',
  'userRoles',
  'userPermissions',
];

function contextFor(user?: { id: string; role: string }) {
  const requestContext = new RequestContext();
  if (user) {
    requestContext.set(MASTRA_NORMALIZED_USER_KEY, user);
    requestContext.set('mastra__user', { sub: user.id });
    requestContext.set('mastra__userRoles', [user.role]);
    requestContext.set('mastra__userPermissions', [`${user.role}:*`]);
    requestContext.set('user', { sub: user.id });
    requestContext.set('userRoles', [user.role]);
    requestContext.set('userPermissions', [`${user.role}:*`]);
  }
  requestContext.set('tenant', 'acme');
  return requestContext;
}

function userKeysFor(user: { id: string; role: string } | undefined) {
  return {
    [MASTRA_NORMALIZED_USER_KEY]: user,
    mastra__user: user && { sub: user.id },
    mastra__userRoles: user && [user.role],
    mastra__userPermissions: user && [`${user.role}:*`],
    user: user && { sub: user.id },
    userRoles: user && [user.role],
    userPermissions: user && [`${user.role}:*`],
  };
}

describe.each([
  ['durable', createDurableAgent],
  ['evented', createEventedAgent],
] as const)('%s agent resume does not keep the starting user', (kind, createAgent) => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    globalRunRegistry.clear();
    await pubsub.close();
  });

  /** An agent whose first model call asks for an approved tool. A resumed process skips that call. */
  function approvalAgent(memory: MockMemory, resumedProcess = false) {
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
    const instructionsSeen: unknown[] = [];
    const approve = createTool({
      id: 'approve',
      description: 'needs approval',
      inputSchema: z.object({}),
      requireApproval: true,
      execute: async (_input, context) => {
        const requestContext = context.requestContext;
        toolSeen.push({
          user: Object.fromEntries(USER_KEYS.map(key => [key, requestContext?.get(key)])),
          tenant: requestContext?.get('tenant'),
        });
        return { ok: true };
      },
    });
    const baseAgent = new Agent({
      id: `resume-user-${kind}`,
      name: `Resume user ${kind}`,
      instructions: ({ user }) => {
        instructionsSeen.push(user);
        return 'Test';
      },
      model: model as LanguageModelV2,
      memory,
      tools: { approve },
    });
    return { agent: createAgent({ agent: baseAgent, pubsub }), toolSeen, instructionsSeen };
  }

  /** Starts a run as alice and waits for it to suspend on the approval. */
  async function suspendAsAlice(storage: InstanceType<typeof MockStore>, memory: MockMemory) {
    const built = approvalAgent(memory);
    new Mastra({ logger: false, storage, agents: { resumeAgent: built.agent } });
    let suspended = false;
    const initial = await built.agent.stream('go', {
      requestContext: contextFor(alice),
      onSuspended: () => {
        suspended = true;
      },
    });
    await vi.waitFor(() => expect(suspended).toBe(true));
    expect(built.instructionsSeen).toContainEqual(alice);
    built.instructionsSeen.length = 0;
    return { ...built, initial };
  }

  async function resume(
    agent: ReturnType<typeof approvalAgent>['agent'],
    runId: string,
    requestContext: RequestContext | undefined,
  ) {
    let finished = false;
    const resumed = await agent.resume(
      runId,
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
  }

  /** Suspends as alice, drops process-local state, and returns a new agent instance over the same storage. */
  async function suspendThenRestartProcess() {
    const storage = new MockStore();
    const memory = new MockMemory({ storage: new InMemoryStore() });
    const { initial } = await suspendAsAlice(storage, memory);
    initial.cleanup();
    globalRunRegistry.clear();
    const fresh = approvalAgent(memory, true);
    new Mastra({ logger: false, storage, agents: { resumeAgent: fresh.agent } });
    return { ...fresh, runId: initial.runId };
  }

  it.each([
    ['a context without a user', () => contextFor(undefined)],
    ['no request context', () => undefined],
  ])('a same-process resume with %s does not act as the starting user', async (_label, resumeContext) => {
    const { agent, initial, toolSeen } = await suspendAsAlice(
      new MockStore(),
      new MockMemory({ storage: new InMemoryStore() }),
    );

    await resume(agent, initial.runId, resumeContext());

    expect(toolSeen).toEqual([{ user: userKeysFor(undefined), tenant: 'acme' }]);
    initial.cleanup();
  });

  it('a same-process resume uses the resuming user', async () => {
    const { agent, initial, toolSeen } = await suspendAsAlice(
      new MockStore(),
      new MockMemory({ storage: new InMemoryStore() }),
    );

    await resume(agent, initial.runId, contextFor(bob));

    expect(toolSeen).toEqual([{ user: userKeysFor(bob), tenant: 'acme' }]);
    initial.cleanup();
  });

  it.each([
    ['a context without a user', () => contextFor(undefined)],
    ['no request context', () => undefined],
  ])('a fresh-process resume with %s does not act as the starting user', async (_label, resumeContext) => {
    const { agent, runId, toolSeen, instructionsSeen } = await suspendThenRestartProcess();

    await resume(agent, runId, resumeContext());

    expect(toolSeen).toEqual([{ user: userKeysFor(undefined), tenant: 'acme' }]);
    // A fresh process resolves the instructions again, without the starting user.
    expect(instructionsSeen).not.toHaveLength(0);
    expect(instructionsSeen.every(user => user === undefined)).toBe(true);
  });

  it('a fresh-process resume uses the resuming user', async () => {
    const { agent, runId, toolSeen } = await suspendThenRestartProcess();

    await resume(agent, runId, contextFor(bob));

    expect(toolSeen).toEqual([{ user: userKeysFor(bob), tenant: 'acme' }]);
  });
});
