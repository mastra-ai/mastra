import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { normalizeBehavior } from '../definition/normalize.js';
import { createStaticBehaviorResolver } from '../definition/resolver.js';
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
      transitions: [{ id: 'implement', target: 'implement' }],
    },
    {
      id: 'implement',
      transitions: [{ id: 'return', target: 'understand' }],
    },
  ],
});
const resolver = createStaticBehaviorResolver(definition);

const makeProvider = async (overrides = {}) => {
  const store = new InMemoryBehaviorRuntimeStore();
  const provider = new BehaviorSignalProvider({
    resolver,
    store,
    resolveThreadId: requestContext => requestContext?.get('threadId'),
    ...overrides,
  });
  await provider.start();
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
    expect(resolveModel).toHaveBeenCalledWith(
      'small',
      expect.objectContaining({ threadId: 'thread', stateId: '$root' }),
    );
    expect(resolveSkillInstructions).toHaveBeenCalledWith(
      ['debugging'],
      expect.objectContaining({ threadId: 'thread', stateId: '$root' }),
    );
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

  it('uses state-signal thread context for tools in ordinary memory-backed agents', async () => {
    const { provider, store } = await makeProvider({ resolveThreadId: () => undefined });
    const requestContext = new RequestContext();
    const stateProcessor = provider.getInputProcessors()[2] as {
      computeStateSignal(args: never): Promise<unknown>;
    };
    await stateProcessor.computeStateSignal({
      threadId: 'studio-thread',
      requestContext,
      contextWindow: { hasSnapshot: false },
      activeStateSignals: [],
      deltasSinceSnapshot: [],
    } as never);
    expect((await store.readThread({ threadId: 'studio-thread', behaviorId: 'coding' }))?.activeState).toBe('$root');
    const tools = provider.getTools() as Record<string, { execute(input: Record<string, unknown>, context: unknown): Promise<unknown> }>;
    await tools.behavior!.execute({ name: 'implement' }, { requestContext, agent: { toolCallId: 'move-1' } });
    expect((await store.readThread({ threadId: 'studio-thread', behaviorId: 'coding' }))?.activeState).toBe('$root/implement');
    const signal = await stateProcessor.computeStateSignal({
      threadId: 'studio-thread',
      requestContext,
      contextWindow: { hasSnapshot: false },
      activeStateSignals: [],
      deltasSinceSnapshot: [],
    } as never) as { tagName?: string; contents?: string; attributes?: Record<string, string> };
    expect(signal).toMatchObject({
      tagName: 'current-behavior',
      attributes: { id: 'coding', state: '$root/implement', status: 'active' },
    });
    expect(signal.contents).toContain('Path: $root/implement');
  });

  it('exposes one stable behavior transition tool with runtime-owned idempotency', async () => {
    const { provider, store } = await makeProvider();
    const tools = provider.getTools() as Record<string, { inputSchema: { toJSONSchema(): unknown }; execute(input: Record<string, unknown>, context: unknown): Promise<unknown> }>;
    expect(Object.keys(tools)).toEqual(['behavior', 'behavior_intent']);
    expect(tools.behavior!.inputSchema.toJSONSchema()).toMatchObject({
      required: ['name'],
      properties: { name: expect.any(Object) },
    });
    expect(JSON.stringify(tools.behavior!.inputSchema.toJSONSchema())).not.toContain('attemptId');
    const context = {
      requestContext: { get: (key: string) => (key === 'threadId' ? 'thread' : undefined) },
      agent: { toolCallId: 'move-1' },
    };
    await tools.behavior!.execute({ name: 'implement' }, context);
    expect((await store.readThread({ threadId: 'thread', behaviorId: 'coding' }))?.activeState).toBe('$root/implement');
    await tools.behavior!.execute({ name: 'implement' }, context);
    expect((await store.readThread({ threadId: 'thread', behaviorId: 'coding' }))?.revision).toBe(2);
    await expect(tools.behavior!.execute({ name: 'missing' }, { ...context, agent: { toolCallId: 'move-2' } })).rejects.toThrow(
      'is not available',
    );
  });
});
