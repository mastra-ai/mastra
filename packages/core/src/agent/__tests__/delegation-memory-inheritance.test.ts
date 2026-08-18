import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { MockMemory } from '../../memory/mock';
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
