import { describe, expect, it, vi } from 'vitest';

import { normalizeBehavior } from '../definition/normalize.js';
import { InMemoryBehaviorRuntimeStore } from '../runtime/in-memory-store.js';
import { BehaviorSignalProvider } from '../runtime/provider.js';

const definition = normalizeBehavior({
  id: 'coding',
  version: '1',
  initialState: 'understand',
  states: [
    {
      id: 'understand',
      instructions: 'Understand before editing.',
      skills: ['debugging'],
      model: 'small',
      transitions: [{ id: 'exit', target: 'exit', exit: true }],
    },
  ],
});

const makeProvider = async (overrides = {}) => {
  const store = new InMemoryBehaviorRuntimeStore();
  const provider = new BehaviorSignalProvider({ definition, store, ...overrides });
  await provider.start();
  await provider.engine.initialize('thread');
  return { provider, store };
};

const inputArgs = () =>
  ({
    requestContext: { get: (key: string) => (key === 'threadId' ? 'thread' : undefined) },
    systemMessages: [],
  }) as never;

describe('BehaviorSignalProvider integration', () => {
  it('routes acting models and injects only active-state instructions and skills', async () => {
    const resolveModel = vi.fn(() => ({ specificationVersion: 'v2' }));
    const resolveSkillInstructions = vi.fn(() => ['Debug systematically.']);
    const { provider } = await makeProvider({ resolveModel, resolveSkillInstructions, unavailableModel: 'error' });
    const routing = provider.getInputProcessors()[1] as {
      processInputStep(args: never): Promise<{ systemMessages?: unknown[] }>;
    };
    const result = await routing.processInputStep(inputArgs());
    expect(resolveModel).toHaveBeenCalledWith('small', { threadId: 'thread', stateId: 'understand' });
    expect(resolveSkillInstructions).toHaveBeenCalledWith(['debugging'], { threadId: 'thread', stateId: 'understand' });
    expect(result.systemMessages).toEqual([
      { role: 'system', content: 'Understand before editing.\n\nDebug systematically.' },
    ]);
    expect(JSON.stringify(result)).not.toContain('judgeInstructions');
  });

  it('fails closed when a configured model is unavailable', async () => {
    const { provider } = await makeProvider({ resolveModel: () => undefined, unavailableModel: 'error' });
    const routing = provider.getInputProcessors()[1] as { processInputStep(args: never): Promise<unknown> };
    await expect(routing.processInputStep(inputArgs())).rejects.toThrow('is unavailable');
  });

  it('exposes stable selection, intent, transition, and exit tools', async () => {
    const { provider, store } = await makeProvider();
    const tools = provider.getTools() as Record<string, { execute(input: Record<string, unknown>, context: unknown): Promise<unknown> }>;
    expect(Object.keys(tools)).toEqual(['behavior_select', 'behavior_intent', 'behavior_transition', 'behavior_exit']);
    await tools.behavior_intent!.execute({ intent: 'understand' }, { threadId: 'thread' });
    expect((await store.readThread({ threadId: 'thread', behaviorId: 'coding' }))?.intent).toBe('understand');
    await tools.behavior_exit!.execute({ attemptId: 'exit-1' }, { threadId: 'thread' });
    expect((await store.readThread({ threadId: 'thread', behaviorId: 'coding' }))?.status).toBe('exited');
  });
});
