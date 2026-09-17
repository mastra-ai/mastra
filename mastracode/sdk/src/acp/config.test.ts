import type { AgentSideConnection } from '@agentclientprotocol/sdk';
import type { AgentController, AgentControllerEvent, Session } from '@mastra/core/agent-controller';
import { describe, expect, it, vi } from 'vitest';
import type { ThinkingLevelSetting } from '../thinking.js';
import { MastraCodeAcpAgent } from './agent.js';

async function setup(modelIds = ['openai/gpt-5.5', 'openai/gpt-5.6-sol'], unavailable: string[] = []) {
  let emit: (event: AgentControllerEvent) => void = () => {};
  const sessionUpdate = vi.fn().mockResolvedValue(undefined);
  let modelId = 'openai/gpt-5.5';
  let modeId = 'build';
  const state: { thinkingLevel?: ThinkingLevelSetting } = {};
  const setState = vi.fn(async updates => {
    Object.assign(state, updates);
  });
  const session = {
    subscribe: (listener: typeof emit) => {
      emit = listener;
      return () => {};
    },
    thread: { create: async () => ({ id: 'config-session' }), switch: async () => {} },
    mode: {
      get: () => modeId,
      switch: async ({ modeId: id }: { modeId: string }) => {
        modeId = id;
      },
    },
    model: {
      get: () => modelId,
      switch: async ({ modelId: id }: { modelId: string }) => {
        modelId = id;
      },
    },
    state: { get: () => state, set: setState },
  } as unknown as Session;
  const agent = new MastraCodeAcpAgent({ sessionUpdate } as unknown as AgentSideConnection, async () => ({
    session,
    controller: {
      listAvailableModels: async () =>
        modelIds.map(id => ({ id, modelName: id.slice(id.indexOf('/') + 1), hasApiKey: !unavailable.includes(id) })),
    } as unknown as AgentController,
    modes: [{ id: 'build' }, { id: 'plan' }],
    getThinkingLevel: () => state.thinkingLevel ?? 'medium',
  }));
  const initial = await agent.newSession({ cwd: '/project', mcpServers: [] });
  return { agent, initial, setState, sessionUpdate, session, emit: (event: AgentControllerEvent) => emit(event) };
}

describe('ACP session configuration', () => {
  it('includes a saved model selection even when discovery returns only gateway-qualified IDs', async () => {
    const { initial } = await setup(['mastracode/openai/gpt-5.5']);
    expect(initial.models?.availableModels).toContainEqual({ modelId: 'openai/gpt-5.5', name: 'openai/gpt-5.5' });
    expect(initial.configOptions?.find(option => option.id === 'model')).toMatchObject({
      currentValue: 'openai/gpt-5.5',
      options: expect.arrayContaining([{ value: 'openai/gpt-5.5', name: 'openai/gpt-5.5' }]),
    });
  });

  it('advertises model, mode, and reasoning choices and persists a selected reasoning level', async () => {
    const { agent, initial, setState } = await setup();
    expect(initial.configOptions?.map(option => option.category)).toEqual(['model', 'mode', 'thought_level']);
    const result = await agent.setSessionConfigOption({
      sessionId: initial.sessionId,
      configId: 'thought_level',
      value: 'high',
    });
    expect(setState).toHaveBeenCalledWith({ thinkingLevel: 'high' });
    expect(result.configOptions.find(option => option.id === 'thought_level')).toMatchObject({ currentValue: 'high' });
  });

  it('returns updated reasoning choices after switching models', async () => {
    const { agent, initial } = await setup();
    const initialThinking = initial.configOptions?.find(option => option.id === 'thought_level');
    expect(initialThinking).toMatchObject({
      type: 'select',
      options: expect.not.arrayContaining([{ value: 'max', name: 'Max' }]),
    });
    const result = await agent.setSessionConfigOption({
      sessionId: initial.sessionId,
      configId: 'model',
      value: 'openai/gpt-5.6-sol',
    });
    expect(result.configOptions.find(option => option.id === 'model')).toMatchObject({
      currentValue: 'openai/gpt-5.6-sol',
    });
    expect(result.configOptions.find(option => option.id === 'thought_level')).toMatchObject({
      options: expect.arrayContaining([{ value: 'max', name: 'Max' }]),
    });
  });

  it('normalizes max when switching to a model whose reasoning scale ends at xhigh', async () => {
    const { agent, initial, setState } = await setup();
    await agent.setSessionConfigOption({
      sessionId: initial.sessionId,
      configId: 'model',
      value: 'openai/gpt-5.6-sol',
    });
    await agent.setSessionConfigOption({ sessionId: initial.sessionId, configId: 'thought_level', value: 'max' });
    const result = await agent.setSessionConfigOption({
      sessionId: initial.sessionId,
      configId: 'model',
      value: 'openai/gpt-5.5',
    });
    expect(setState).toHaveBeenLastCalledWith({ thinkingLevel: 'xhigh' });
    expect(result.configOptions.find(option => option.id === 'thought_level')).toMatchObject({ currentValue: 'xhigh' });
  });

  it('notifies clients when the runtime changes mode outside a configuration request', async () => {
    const { initial, sessionUpdate, session, emit } = await setup();
    await session.mode.switch({ modeId: 'plan' });
    emit({ type: 'mode_changed', modeId: 'plan', previousModeId: 'build' });
    expect(sessionUpdate).toHaveBeenCalledWith({
      sessionId: initial.sessionId,
      update: {
        sessionUpdate: 'config_option_update',
        configOptions: expect.arrayContaining([expect.objectContaining({ id: 'mode', currentValue: 'plan' })]),
      },
    });
  });

  it.each([
    { configId: 'thought_level', value: 'unsupported' },
    { configId: 'thought_level', value: 'max' },
    { configId: 'missing', value: 'high' },
    { configId: 'model', value: 'missing/model' },
    { configId: 'mode', value: 'missing' },
  ])('rejects an unavailable config selection $configId=$value', async selection => {
    const { agent, initial, setState } = await setup();
    await expect(agent.setSessionConfigOption({ sessionId: initial.sessionId, ...selection })).rejects.toMatchObject({
      code: -32602,
    });
    expect(setState).not.toHaveBeenCalled();
  });
});

it('notifies legacy mode clients as well as configuration clients', async () => {
  const { initial, session, emit, sessionUpdate } = await setup();
  await session.mode.switch({ modeId: 'plan' });
  emit({ type: 'mode_changed', modeId: 'plan', previousModeId: 'build' });
  expect(sessionUpdate).toHaveBeenCalledWith({
    sessionId: initial.sessionId,
    update: { sessionUpdate: 'current_mode_update', currentModeId: 'plan' },
  });
  expect(sessionUpdate).toHaveBeenCalledWith(
    expect.objectContaining({
      update: expect.objectContaining({ sessionUpdate: 'config_option_update' }),
    }),
  );
});

describe('ACP model routing catalog', () => {
  it('hides unconfigured gateways and keeps full route IDs visible', async () => {
    const direct = 'openrouter/openai/gpt-4.1-mini';
    const gateway = 'netlify/openrouter/openai/gpt-4.1-mini';
    const { initial } = await setup([direct, gateway, direct], [gateway]);
    expect(initial.models?.availableModels).toEqual([
      { modelId: 'openai/gpt-5.5', name: 'openai/gpt-5.5' },
      { modelId: direct, name: direct },
    ]);
    expect(initial.configOptions?.find(option => option.id === 'model')).toMatchObject({
      options: [
        { value: 'openai/gpt-5.5', name: 'openai/gpt-5.5' },
        { value: direct, name: direct },
      ],
    });
  });

  it('distinguishes a configured gateway route from direct OpenRouter', async () => {
    const direct = 'openrouter/openai/gpt-4.1-mini';
    const gateway = 'netlify/openrouter/openai/gpt-4.1-mini';
    const { agent, initial, session } = await setup([direct, gateway]);
    expect(initial.models?.availableModels).toContainEqual({ modelId: gateway, name: gateway });
    await agent.setSessionConfigOption({ sessionId: initial.sessionId, configId: 'model', value: direct });
    expect(session.model.get()).toBe(direct);
    await agent.unstable_setSessionModel({ sessionId: initial.sessionId, modelId: direct });
    expect(session.model.get()).toBe(direct);
  });

  it('rejects an unavailable stale BB model selection on the legacy endpoint', async () => {
    const gateway = 'netlify/openrouter/openai/gpt-4.1-mini';
    const { agent, initial, session } = await setup([gateway], [gateway]);
    await expect(
      agent.unstable_setSessionModel({ sessionId: initial.sessionId, modelId: gateway }),
    ).rejects.toMatchObject({ code: -32602 });
    expect(session.model.get()).toBe('openai/gpt-5.5');
  });
});

it('labels a saved selection whose provider is not configured', async () => {
  const { initial } = await setup(['openai/gpt-5.5', 'openrouter/openai/gpt-4.1-mini'], ['openai/gpt-5.5']);
  expect(initial.models?.availableModels).toContainEqual({
    modelId: 'openai/gpt-5.5',
    name: 'openai/gpt-5.5 (provider not configured)',
  });
});
