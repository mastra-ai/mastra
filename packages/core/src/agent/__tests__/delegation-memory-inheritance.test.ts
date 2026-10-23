import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { FGADeniedError } from '../../auth/ee/fga-check';
import type { IFGAProvider } from '../../auth/ee/interfaces/fga';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { RequestContext } from '../../request-context';
import { Agent } from '../agent';
import type { SubAgent } from '../subagent';

function makeSubAgentModel(responseText: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
      text: responseText,
      content: [{ type: 'text' as const, text: responseText }],
      warnings: [],
    }),
  });
}

function makeSupervisorModel(subAgentKey: string, prompt: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doGenerate: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          text: '',
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: `call-${callCount}`,
              toolName: `agent-${subAgentKey}`,
              input: JSON.stringify({ prompt }),
            },
          ],
          warnings: [],
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        text: 'Done',
        content: [{ type: 'text' as const, text: 'Done' }],
        warnings: [],
      };
    },
  });
}

function makeSubAgent(id = 'sub-agent', memory?: MockMemory) {
  return new Agent({
    id,
    name: id,
    instructions: 'You are a sub-agent.',
    model: makeSubAgentModel('sub response'),
    ...(memory ? { memory } : {}),
  });
}

function makeSupervisor(sub: Agent<any, any, any, any>, memory: MockMemory, id = 'supervisor') {
  return new Agent({
    id,
    name: id,
    instructions: 'You delegate.',
    model: makeSupervisorModel('sub-agent', 'do the thing'),
    agents: { 'sub-agent': sub },
    memory,
  });
}

function createMemoryWriteDenyProvider(deniedAgentId: string): IFGAProvider {
  return {
    check: vi.fn(),
    filterAccessible: vi.fn(),
    require: vi.fn(async (user, input) => {
      if (input.permission === 'memory:write' && input.context?.metadata?.agentId === deniedAgentId) {
        throw new FGADeniedError(user, input.resource, input.permission);
      }
    }),
  };
}

function createActorRequestContext() {
  const requestContext = new RequestContext();
  requestContext.set('user', { id: 'user-1', organizationMembershipId: 'membership-1' });
  requestContext.set('actor', { id: 'actor-1', type: 'user' });
  return requestContext;
}

describe('delegation memory inheritance (issue #21625)', () => {
  it('does not mutate the shared sub-agent instance when inheriting parent memory', async () => {
    const sub = makeSubAgent();
    const supervisor = makeSupervisor(sub, new MockMemory());

    expect(sub.hasOwnMemory()).toBe(false);

    await supervisor.generate('Delegate please', {
      maxSteps: 3,
      memory: { thread: 'thread-1', resource: 'resource-1' },
    });

    // The singleton sub-agent must be left exactly as the developer configured it.
    expect(sub.hasOwnMemory()).toBe(false);
    await expect(sub.getMemory()).resolves.toBeUndefined();
  });

  it('keeps two supervisors with distinct memory instances isolated', async () => {
    const sub = makeSubAgent();

    const memoryA = new MockMemory();
    const memoryB = new MockMemory();
    const saveA = vi.spyOn(memoryA, 'saveMessages');
    const saveB = vi.spyOn(memoryB, 'saveMessages');

    const supervisorA = makeSupervisor(sub, memoryA, 'supervisor-a');
    const supervisorB = makeSupervisor(sub, memoryB, 'supervisor-b');

    await supervisorA.generate('Delegate please', {
      maxSteps: 3,
      memory: { thread: 'thread-a', resource: 'resource-a' },
    });
    await supervisorB.generate('Delegate please', {
      maxSteps: 3,
      memory: { thread: 'thread-b', resource: 'resource-b' },
    });

    // Before the fix, supervisor A's memory was grafted onto the shared sub-agent
    // and supervisor B's delegation reused it, so memoryB never saw a write.
    expect(saveA).toHaveBeenCalled();
    expect(saveB).toHaveBeenCalled();

    // Each supervisor's delegation transcript lands only in that supervisor's memory.
    const resourcesInA = [...new Set(saveA.mock.calls.flatMap(call => call[0].messages.map(m => m.resourceId)))];
    const resourcesInB = [...new Set(saveB.mock.calls.flatMap(call => call[0].messages.map(m => m.resourceId)))];
    expect(resourcesInA).toEqual(['resource-a-sub-agent']);
    expect(resourcesInB).toEqual(['resource-b-sub-agent']);
  });

  it('leaves the shared sub-agent untouched across repeated delegations', async () => {
    const sub = makeSubAgent();
    const supervisor = makeSupervisor(sub, new MockMemory());

    await supervisor.generate('Delegate please', {
      maxSteps: 3,
      memory: { thread: 'thread-1', resource: 'resource-1' },
    });
    await supervisor.generate('Delegate again', {
      maxSteps: 3,
      memory: { thread: 'thread-1', resource: 'resource-1' },
    });

    expect(sub.hasOwnMemory()).toBe(false);
  });

  it('delegates through the sub-agent instance itself, not a copy', async () => {
    const sub = makeSubAgent();
    const generateSpy = vi.spyOn(sub, 'generate');
    const supervisor = makeSupervisor(sub, new MockMemory());

    await supervisor.generate('Delegate please', {
      maxSteps: 3,
      memory: { thread: 'thread-1', resource: 'resource-1' },
    });

    expect(generateSpy).toHaveBeenCalledTimes(1);
  });

  it('leaves a sub-agent that has its own memory alone', async () => {
    const ownMemory = new MockMemory();
    const sub = makeSubAgent('sub-agent', ownMemory);
    const supervisor = makeSupervisor(sub, new MockMemory());

    await supervisor.generate('Delegate please', {
      maxSteps: 3,
      memory: { thread: 'thread-1', resource: 'resource-1' },
    });

    await expect(sub.getMemory()).resolves.toBe(ownMemory);
  });

  it('denies delegated transcript persistence before writing to sub-agent memory', async () => {
    const subMemory = new MockMemory();
    const saveMessages = vi.spyOn(subMemory, 'saveMessages');
    const sub = makeSubAgent('sub-agent', subMemory);
    const supervisor = makeSupervisor(sub, new MockMemory());
    const fgaProvider = createMemoryWriteDenyProvider('sub-agent');
    new Mastra({
      agents: { supervisor, sub },
      logger: false,
      server: { fga: fgaProvider },
    });

    await supervisor.generate('Delegate please', {
      maxSteps: 3,
      memory: { thread: 'thread-1', resource: 'resource-1' },
      requestContext: createActorRequestContext(),
    });

    expect(fgaProvider.require).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', organizationMembershipId: 'membership-1' }),
      expect.objectContaining({
        permission: 'memory:write',
        resource: { type: 'thread', id: expect.any(String) },
        context: expect.objectContaining({ metadata: expect.objectContaining({ agentId: 'sub-agent' }) }),
      }),
    );
    const authorization = vi
      .mocked(fgaProvider.require)
      .mock.calls.find(
        ([, input]) => input.permission === 'memory:write' && input.context?.metadata?.agentId === 'sub-agent',
      )?.[1];
    expect(authorization?.context?.requestContext?.get('actor')).toEqual({ id: 'actor-1', type: 'user' });
    expect(saveMessages).not.toHaveBeenCalled();
  });

  it('persists supervisor feedback when the write is allowed', async () => {
    const supervisorMemory = new MockMemory();
    const saveMessages = vi.spyOn(supervisorMemory, 'saveMessages');
    const sub = makeSubAgent('sub-agent', new MockMemory());
    const supervisor = makeSupervisor(sub, supervisorMemory);
    const fgaProvider = createMemoryWriteDenyProvider('unmatched-agent');
    new Mastra({ agents: { supervisor, sub }, logger: false, server: { fga: fgaProvider } });

    await supervisor.generate('Delegate please', {
      maxSteps: 3,
      memory: { thread: 'thread-1', resource: 'resource-1' },
      requestContext: createActorRequestContext(),
      delegation: { onDelegationComplete: () => ({ feedback: 'Supervisor feedback' }) },
    });

    expect(
      saveMessages.mock.calls.some(call =>
        call[0].messages.some(message =>
          message.content.parts.some(part => part.type === 'text' && part.text === 'Supervisor feedback'),
        ),
      ),
    ).toBe(true);
  });

  it('denies supervisor feedback persistence before writing the feedback message', async () => {
    const supervisorMemory = new MockMemory();
    const saveMessages = vi.spyOn(supervisorMemory, 'saveMessages');
    const sub = makeSubAgent('sub-agent', new MockMemory());
    const supervisor = makeSupervisor(sub, supervisorMemory);
    let supervisorWriteChecks = 0;
    const fgaProvider: IFGAProvider = {
      check: vi.fn(),
      filterAccessible: vi.fn(),
      require: vi.fn(async (user, input) => {
        if (input.permission === 'memory:write' && input.context?.metadata?.agentId === 'supervisor') {
          supervisorWriteChecks++;
          if (supervisorWriteChecks > 1) {
            throw new FGADeniedError(user, input.resource, input.permission);
          }
        }
      }),
    };
    new Mastra({ agents: { supervisor, sub }, logger: false, server: { fga: fgaProvider } });

    await supervisor.generate('Delegate please', {
      maxSteps: 3,
      memory: { thread: 'thread-1', resource: 'resource-1' },
      requestContext: createActorRequestContext(),
      delegation: { onDelegationComplete: () => ({ feedback: 'Supervisor feedback' }) },
    });

    expect(supervisorWriteChecks).toBeGreaterThan(1);
    expect(fgaProvider.require).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', organizationMembershipId: 'membership-1' }),
      expect.objectContaining({
        permission: 'memory:write',
        resource: { type: 'thread', id: expect.any(String) },
        context: expect.objectContaining({ metadata: expect.objectContaining({ agentId: 'supervisor' }) }),
      }),
    );
    const authorization = vi
      .mocked(fgaProvider.require)
      .mock.calls.find(
        ([, input]) => input.permission === 'memory:write' && input.context?.metadata?.agentId === 'supervisor',
      )?.[1];
    expect(authorization?.context?.requestContext?.get('actor')).toEqual({ id: 'actor-1', type: 'user' });
    expect(
      saveMessages.mock.calls.some(call =>
        call[0].messages.some(message =>
          message.content.parts.some(part => part.type === 'text' && part.text === 'Supervisor feedback'),
        ),
      ),
    ).toBe(false);
  });

  it('does not pass inherited memory further down to a grandchild sub-agent', async () => {
    const grandchild = makeSubAgent('grandchild');
    const grandchildMemorySpy = vi.spyOn(grandchild, 'getMemory');

    // The middle agent has no memory of its own, so it only ever sees the
    // supervisor's memory for the duration of the delegated run.
    const middle = new Agent({
      id: 'sub-agent',
      name: 'sub-agent',
      instructions: 'You delegate too.',
      model: makeSupervisorModel('grandchild', 'do the sub-thing'),
      agents: { grandchild },
    });
    const supervisor = makeSupervisor(middle, new MockMemory());

    await supervisor.generate('Delegate please', {
      maxSteps: 3,
      memory: { thread: 'thread-1', resource: 'resource-1' },
    });

    expect(grandchildMemorySpy).toHaveBeenCalled();
    const resolved = await Promise.all(grandchildMemorySpy.mock.results.map(result => result.value));
    expect(resolved.every(memory => memory === undefined)).toBe(true);
    expect(grandchild.hasOwnMemory()).toBe(false);
  });

  it('falls back to in-place injection for custom sub-agent implementations', async () => {
    let injectedMemory: unknown;
    const customSubAgent = {
      id: 'sub-agent',
      name: 'sub-agent',
      getDescription: () => 'A custom sub-agent',
      getModel: () => makeSubAgentModel('custom response'),
      getInstructions: () => 'custom instructions',
      hasOwnMemory: () => Boolean(injectedMemory),
      __setMemory: (memory: unknown) => {
        injectedMemory = memory;
      },
      getMemory: () => injectedMemory as any,
      generate: async () => ({ text: 'custom response' }),
      stream: async () => ({}) as any,
      resumeGenerate: async () => undefined as any,
      resumeStream: async () => undefined as any,
    } satisfies Partial<SubAgent> as unknown as SubAgent;

    const supervisorMemory = new MockMemory();
    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'You delegate.',
      model: makeSupervisorModel('sub-agent', 'do the thing'),
      agents: { 'sub-agent': customSubAgent },
      memory: supervisorMemory,
    });

    await supervisor.generate('Delegate please', {
      maxSteps: 3,
      memory: { thread: 'thread-1', resource: 'resource-1' },
    });

    expect(injectedMemory).toBe(supervisorMemory);
  });
});
