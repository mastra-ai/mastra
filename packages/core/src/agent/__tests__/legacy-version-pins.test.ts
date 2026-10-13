import { MockLanguageModelV1, simulateReadableStream } from '@internal/ai-sdk-v4/test';
import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../mastra';
import { MASTRA_VERSIONS_KEY, RequestContext } from '../../request-context';
import { Agent } from '../agent';
import { getAgentVersionPins, MASTRA_AGENT_VERSION_PINS_DELEGATED_KEY, setAgentVersionPins } from '../version-pins';

function textModel(text: string) {
  const doGenerate = vi.fn(async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop' as const,
    usage: { promptTokens: 5, completionTokens: 10 },
    text,
  }));
  const doStream = vi.fn(async () => ({
    stream: simulateReadableStream({
      chunks: [
        { type: 'text-delta' as const, textDelta: text },
        {
          type: 'finish' as const,
          finishReason: 'stop' as const,
          logprobs: undefined,
          usage: { promptTokens: 5, completionTokens: 10 },
        },
      ],
    }),
    rawCall: { rawPrompt: null, rawSettings: {} },
  }));
  return { model: new MockLanguageModelV1({ doGenerate, doStream }), doGenerate, doStream };
}

function resolvedAgent(id: string, text: string, versionId: string) {
  const model = textModel(text);
  const agent = new Agent({ id, name: id, instructions: id, model: model.model });
  agent.__setRawConfig({ resolvedVersionId: versionId });
  return { agent, ...model };
}

describe('legacy agent version boundary', () => {
  it.each(['generateLegacy', 'streamLegacy'] as const)(
    'resolves %s method-default labels before choosing the root and graph',
    async method => {
      const requestContext = new RequestContext();
      const child = new Agent({ id: 'child', name: 'child', instructions: 'child', model: textModel('child').model });
      const defaults = { versions: { defaultLabel: 'candidate' } };
      const root = new Agent({
        id: 'root',
        name: 'root',
        instructions: 'root',
        model: textModel('done').model,
        agents: { child },
        ...(method === 'generateLegacy'
          ? { defaultGenerateOptionsLegacy: defaults }
          : { defaultStreamOptionsLegacy: defaults }),
      });
      const applyStoredOverrides = vi.fn(async (agent: Agent, _selector: any) => {
        const fork = agent.__fork();
        fork.__setRawConfig({ resolvedVersionId: `${agent.id}-candidate` });
        return fork;
      });
      new Mastra({ agents: { root, child }, editor: { agent: { applyStoredOverrides } } as any });

      const result = await root[method]('start', { requestContext });
      if ('consumeStream' in result) await result.consumeStream();

      expect(applyStoredOverrides.mock.calls.map(([agent, selector]) => [agent.id, selector])).toEqual([
        ['root', { label: 'candidate' }],
        ['child', { label: 'candidate' }],
        ['child', { versionId: 'child-candidate' }],
      ]);
      expect(getAgentVersionPins(requestContext)).toMatchObject({
        root: { agentId: 'root', versionId: 'root-candidate' },
        agents: { child: { agentId: 'child', versionId: 'child-candidate' } },
      });
      expect(requestContext.get(MASTRA_VERSIONS_KEY)).toBeUndefined();
    },
  );

  it.each(['generateLegacy', 'streamLegacy'] as const)(
    'evaluates dynamic %s defaults once per independent run with the original context',
    async method => {
      const requestContext = new RequestContext();
      const contextVersions = { defaultLabel: 'context-default' };
      requestContext.set(MASTRA_VERSIONS_KEY, contextVersions);
      requestContext.set('tenant', 'original-tenant');
      const model = textModel('done');
      const instructions = vi.fn(({ requestContext: context }: { requestContext: RequestContext }) => {
        expect(context).toBe(requestContext);
        return 'root';
      });
      const defaults = vi.fn(async ({ requestContext: context }: { requestContext: RequestContext }) => {
        expect(context).toBe(requestContext);
        expect(context.get(MASTRA_VERSIONS_KEY)).toBe(contextVersions);
        context.set('default-evaluated', true);
        return { versions: { defaultLabel: 'candidate' }, temperature: 0.25 };
      });
      const root = new Agent({
        id: 'root',
        name: 'root',
        instructions,
        model: model.model,
        ...(method === 'generateLegacy'
          ? { defaultGenerateOptionsLegacy: defaults }
          : { defaultStreamOptionsLegacy: defaults }),
      });
      let target = 'v1';
      const applyStoredOverrides = vi.fn(async (agent: Agent, selector: any) => {
        const fork = agent.__fork();
        fork.__setRawConfig({ resolvedVersionId: selector.versionId ?? target });
        return fork;
      });
      new Mastra({ agents: { root }, editor: { agent: { applyStoredOverrides } } as any });

      for (const versionId of ['v1', 'v2']) {
        target = versionId;
        const result = await root[method]('start', { requestContext, temperature: 0.75 });
        if ('consumeStream' in result) await result.consumeStream();
        expect(getAgentVersionPins(requestContext)?.root?.versionId).toBe(versionId);
        expect(requestContext.get(MASTRA_VERSIONS_KEY)).toBe(contextVersions);
      }

      expect(defaults).toHaveBeenCalledTimes(2);
      expect(applyStoredOverrides.mock.calls.map(([, selector]) => selector)).toEqual([
        { label: 'candidate' },
        { label: 'candidate' },
      ]);
      expect(requestContext.get('tenant')).toBe('original-tenant');
      expect(requestContext.get('default-evaluated')).toBe(true);
      expect(instructions).toHaveBeenCalled();
      const modelCall = method === 'generateLegacy' ? model.doGenerate : model.doStream;
      expect(modelCall).toHaveBeenCalledTimes(2);
      expect(modelCall).toHaveBeenNthCalledWith(1, expect.objectContaining({ temperature: 0.75 }));
      expect(modelCall).toHaveBeenNthCalledWith(2, expect.objectContaining({ temperature: 0.75 }));
    },
  );

  it.each(['generateLegacy', 'streamLegacy'] as const)(
    'keeps explicit %s root selectors ahead of method defaults without dropping graph defaults',
    async method => {
      const requestContext = new RequestContext();
      const child = new Agent({ id: 'child', name: 'child', instructions: 'child', model: textModel('child').model });
      const defaults = { versions: { defaultLabel: 'candidate', agents: { root: { label: 'production' } } } };
      const root = new Agent({
        id: 'root',
        name: 'root',
        instructions: 'root',
        model: textModel('done').model,
        agents: { child },
        ...(method === 'generateLegacy'
          ? { defaultGenerateOptionsLegacy: defaults }
          : { defaultStreamOptionsLegacy: defaults }),
      });
      const applyStoredOverrides = vi.fn(async (agent: Agent, selector: any) => {
        const fork = agent.__fork();
        fork.__setRawConfig({ resolvedVersionId: selector.versionId ?? `${agent.id}-candidate` });
        return fork;
      });
      new Mastra({ agents: { root, child }, editor: { agent: { applyStoredOverrides } } as any });

      const result = await root[method]('start', {
        requestContext,
        versions: { agents: { root: { versionId: 'root-explicit' } } },
      });
      if ('consumeStream' in result) await result.consumeStream();

      expect(applyStoredOverrides.mock.calls.map(([agent, selector]) => [agent.id, selector])).toEqual([
        ['root', { versionId: 'root-explicit' }],
        ['child', { label: 'candidate' }],
        ['child', { versionId: 'child-candidate' }],
      ]);
      expect(getAgentVersionPins(requestContext)).toMatchObject({
        root: { agentId: 'root', versionId: 'root-explicit' },
        agents: { child: { agentId: 'child', versionId: 'child-candidate' } },
      });
    },
  );

  it.each(['generateLegacy', 'streamLegacy'] as const)(
    'uses the original %s defaults on the selected fork without re-evaluating either factory',
    async method => {
      let originalContext: RequestContext | undefined;
      const defaults = vi.fn(async ({ requestContext }: { requestContext: RequestContext }) => {
        originalContext = requestContext;
        requestContext.set('default-marker', 'original');
        return { versions: { defaultLabel: 'candidate' }, temperature: 0.25 };
      });
      const selectedDefaults = vi.fn(() => ({ temperature: 0.9 }));
      const root = new Agent({
        id: 'root',
        name: 'root',
        instructions: 'root',
        model: textModel('base').model,
        ...(method === 'generateLegacy'
          ? { defaultGenerateOptionsLegacy: defaults }
          : { defaultStreamOptionsLegacy: defaults }),
      });
      const model = textModel('selected');
      const selected = new Agent({
        id: 'root',
        name: 'selected',
        instructions: ({ requestContext }) => {
          expect(requestContext).toBe(originalContext);
          expect(requestContext.get('default-marker')).toBe('original');
          return 'selected';
        },
        model: model.model,
        ...(method === 'generateLegacy'
          ? { defaultGenerateOptionsLegacy: selectedDefaults }
          : { defaultStreamOptionsLegacy: selectedDefaults }),
      });
      selected.__setRawConfig({ resolvedVersionId: 'root-candidate' });
      const mastra = new Mastra({ agents: { root } });
      const resolve = vi.spyOn(mastra, 'resolveVersionedAgent').mockResolvedValue(selected);

      const result = await root[method]('start');
      if ('consumeStream' in result) await result.consumeStream();

      expect(await result.text).toBe('selected');
      expect(defaults).toHaveBeenCalledExactlyOnceWith({ requestContext: originalContext, mastra });
      expect(selectedDefaults).not.toHaveBeenCalled();
      expect(resolve).toHaveBeenCalledExactlyOnceWith(root, { label: 'candidate' });
      expect(method === 'generateLegacy' ? model.doGenerate : model.doStream).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0.25 }),
      );
      expect(originalContext?.get(MASTRA_VERSIONS_KEY)).toBeUndefined();
    },
  );

  it.each(['generateLegacy', 'streamLegacy'] as const)(
    'restores the original context policy when %s fails after resolving method defaults',
    async method => {
      const requestContext = new RequestContext();
      const contextVersions = { defaultLabel: 'context-default' };
      requestContext.set(MASTRA_VERSIONS_KEY, contextVersions);
      const defaults = vi.fn(() => ({ versions: { defaultLabel: 'candidate' } }));
      const root = new Agent({
        id: 'root',
        name: 'root',
        instructions: () => {
          throw new Error('instruction failure');
        },
        model: textModel('unused').model,
        ...(method === 'generateLegacy'
          ? { defaultGenerateOptionsLegacy: defaults }
          : { defaultStreamOptionsLegacy: defaults }),
      });
      const applyStoredOverrides = vi.fn(async (agent: Agent) => {
        const fork = agent.__fork();
        fork.__setRawConfig({ resolvedVersionId: 'root-candidate' });
        return fork;
      });
      const mastra = new Mastra({ agents: { root }, editor: { agent: { applyStoredOverrides } } as any });

      await expect(root[method]('start', { requestContext })).rejects.toThrow('instruction failure');
      expect(requestContext.get(MASTRA_VERSIONS_KEY)).toBe(contextVersions);
      expect(defaults).toHaveBeenCalledExactlyOnceWith({ requestContext, mastra });
    },
  );

  it.each([
    ['generateLegacy', 'root-original'],
    ['streamLegacy', 'root-original'],
    ['generateLegacy', undefined],
    ['streamLegacy', undefined],
  ] as const)(
    'preserves inherited immutable pins ahead of movable %s method defaults (version: %s)',
    async (method, versionId) => {
      const requestContext = new RequestContext();
      const defaults = vi.fn(() => ({ versions: { defaultLabel: 'moved-label' } }));
      const root = new Agent({
        id: 'root',
        name: 'root',
        instructions: 'root',
        model: textModel('pinned-root').model,
        ...(method === 'generateLegacy'
          ? { defaultGenerateOptionsLegacy: defaults }
          : { defaultStreamOptionsLegacy: defaults }),
      });
      if (versionId) root.__setRawConfig({ resolvedVersionId: versionId });
      const mastra = new Mastra({ agents: { root }, versions: { defaultLabel: 'mastra-moved-label' } });
      const resolve = vi.spyOn(mastra, 'resolveVersionedAgent');
      setAgentVersionPins(requestContext, {
        ...(versionId ? { root: { agentId: 'root', versionId } } : {}),
        resolvedAgentIds: ['root'],
      });
      requestContext.set(MASTRA_AGENT_VERSION_PINS_DELEGATED_KEY, true);

      const result = await root[method]('continue', { requestContext });
      if ('consumeStream' in result) await result.consumeStream();

      expect(await result.text).toBe('pinned-root');
      expect(defaults).toHaveBeenCalledExactlyOnceWith({ requestContext, mastra });
      expect(resolve).not.toHaveBeenCalled();
      expect(getAgentVersionPins(requestContext)?.root?.versionId).toBe(versionId);
      expect(requestContext.get(MASTRA_VERSIONS_KEY)).toEqual(versionId ? { agents: { root: { versionId } } } : {});
    },
  );

  it.each(['generateLegacy', 'streamLegacy'] as const)(
    'honors a %s default request context unless the caller supplies one',
    async method => {
      const defaultContext = new RequestContext();
      const callerContext = new RequestContext();
      const defaultVersions = { defaultLabel: 'default-context' };
      const callerVersions = { defaultLabel: 'caller-context' };
      defaultContext.set(MASTRA_VERSIONS_KEY, defaultVersions);
      callerContext.set(MASTRA_VERSIONS_KEY, callerVersions);
      const instructions = vi.fn(() => 'root');
      const defaults = vi.fn(async () => ({ requestContext: defaultContext }));
      const root = new Agent({
        id: 'root',
        name: 'root',
        instructions,
        model: textModel('done').model,
        ...(method === 'generateLegacy'
          ? { defaultGenerateOptionsLegacy: defaults }
          : { defaultStreamOptionsLegacy: defaults }),
      });
      const applyStoredOverrides = vi.fn(async (agent: Agent, selector: any) => {
        const fork = agent.__fork();
        fork.__setRawConfig({ resolvedVersionId: selector.label });
        return fork;
      });
      new Mastra({ agents: { root }, editor: { agent: { applyStoredOverrides } } as any });

      for (const context of [undefined, callerContext]) {
        const result = await root[method]('start', context ? { requestContext: context } : {});
        if ('consumeStream' in result) await result.consumeStream();
      }

      expect(defaults).toHaveBeenCalledTimes(2);
      expect(instructions).toHaveBeenNthCalledWith(1, expect.objectContaining({ requestContext: defaultContext }));
      expect(instructions).toHaveBeenNthCalledWith(2, expect.objectContaining({ requestContext: callerContext }));
      expect(applyStoredOverrides.mock.calls.map(([, selector]) => selector)).toEqual([
        { label: 'default-context' },
        { label: 'caller-context' },
      ]);
      expect(defaultContext.get(MASTRA_VERSIONS_KEY)).toBe(defaultVersions);
      expect(callerContext.get(MASTRA_VERSIONS_KEY)).toBe(callerVersions);
    },
  );

  it.each(['generateLegacy', 'streamLegacy'] as const)(
    'preserves caller context and re-resolves moved defaults for independent %s runs',
    async method => {
      let target = 'v1';
      const requestContext = new RequestContext();
      const instructions = vi.fn(({ requestContext: context }: { requestContext: RequestContext }) => {
        context.set('seen', true);
        return 'root';
      });
      const root = new Agent({ id: 'root', name: 'root', instructions, model: textModel('done').model });
      const applyStoredOverrides = vi.fn(async (agent: Agent, selector: any) => {
        const fork = agent.__fork();
        fork.__setRawConfig({ resolvedVersionId: selector.versionId ?? target });
        return fork;
      });
      new Mastra({ agents: { root }, editor: { agent: { applyStoredOverrides } } as any });
      const versions = { defaultLabel: 'candidate' };
      requestContext.set(MASTRA_VERSIONS_KEY, versions);

      for (const version of ['v1', 'v2']) {
        target = version;
        const result = await root[method]('start', { requestContext });
        if ('consumeStream' in result) await result.consumeStream();
        expect(requestContext.get(MASTRA_VERSIONS_KEY)).toBe(versions);
      }

      expect(instructions.mock.calls.every(([args]) => args.requestContext === requestContext)).toBe(true);
      expect(requestContext.get('seen')).toBe(true);
      expect(applyStoredOverrides.mock.calls.map(([, selector]) => selector)).toEqual([
        { label: 'candidate' },
        { label: 'candidate' },
      ]);
    },
  );

  it('resolves a root label before direct generateLegacy behavior', async () => {
    const baseModel = textModel('base');
    const root = new Agent({ id: 'legacy-root', name: 'root', instructions: 'root', model: baseModel.model });
    const selected = resolvedAgent('legacy-root', 'selected-v1', 'root-v1');
    const mastra = new Mastra({ agents: { root } });
    const resolve = vi.spyOn(mastra, 'resolveVersionedAgent').mockResolvedValue(selected.agent);

    const result = await root.generateLegacy('start', {
      versions: { defaultLabel: 'production' },
    });

    expect(result.text).toBe('selected-v1');
    expect(resolve).toHaveBeenCalledWith(root, { label: 'production' });
    expect(selected.doGenerate).toHaveBeenCalledOnce();
    expect(baseModel.doGenerate).not.toHaveBeenCalled();
  });

  it('resolves a root label before direct streamLegacy behavior', async () => {
    const baseModel = textModel('base');
    const root = new Agent({ id: 'legacy-stream-root', name: 'root', instructions: 'root', model: baseModel.model });
    const selected = resolvedAgent('legacy-stream-root', 'selected-stream-v1', 'root-v1');
    const mastra = new Mastra({ agents: { root } });
    const resolve = vi.spyOn(mastra, 'resolveVersionedAgent').mockResolvedValue(selected.agent);

    const result = await root.streamLegacy('start', {
      versions: { defaultLabel: 'production' },
    });

    await result.consumeStream();
    expect(await result.text).toBe('selected-stream-v1');
    expect(resolve).toHaveBeenCalledWith(root, { label: 'production' });
    expect(selected.doStream).toHaveBeenCalledOnce();
    expect(baseModel.doStream).not.toHaveBeenCalled();
  });

  it('keeps a dependency label pinned when it moves after legacy model behavior starts', async () => {
    let releaseRouting!: () => void;
    const routingReleased = new Promise<void>(resolve => {
      releaseRouting = resolve;
    });
    let reportRoutingStarted!: () => void;
    const routingStarted = new Promise<void>(resolve => {
      reportRoutingStarted = resolve;
    });
    let supervisorCallCount = 0;
    const supervisorModel = new MockLanguageModelV1({
      doGenerate: async () => {
        supervisorCallCount++;
        if (supervisorCallCount === 1) {
          reportRoutingStarted();
          await routingReleased;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls' as const,
            usage: { promptTokens: 5, completionTokens: 10 },
            text: undefined,
            toolCalls: [
              {
                toolCallType: 'function' as const,
                toolCallId: 'delegate-1',
                toolName: 'agent-sub',
                args: JSON.stringify({ prompt: 'continue' }),
              },
            ],
          };
        }
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { promptTokens: 5, completionTokens: 10 },
          text: 'done',
        };
      },
    });
    const configuredSub = new Agent({
      id: 'sub-agent',
      name: 'sub',
      instructions: 'sub',
      model: textModel('base-sub').model,
    });
    const subV1 = resolvedAgent('sub-agent', 'sub-v1', 'sub-v1');
    const subV2 = resolvedAgent('sub-agent', 'sub-v2', 'sub-v2');
    const supervisor = new Agent({
      id: 'legacy-supervisor',
      name: 'supervisor',
      instructions: 'delegate',
      model: supervisorModel,
      agents: { sub: configuredSub },
    });
    const mastra = new Mastra({ agents: { supervisor, configuredSub } });
    let labelTarget = 'sub-v1';
    const selectors: unknown[] = [];
    vi.spyOn(mastra, 'resolveVersionedAgent').mockImplementation(async (_agent, selector) => {
      selectors.push(selector);
      const versionId = 'versionId' in selector ? selector.versionId : labelTarget;
      return versionId === 'sub-v1' ? subV1.agent : subV2.agent;
    });

    const run = supervisor.generateLegacy('start', {
      maxSteps: 3,
      versions: { agents: { 'sub-agent': { label: 'production' } } },
    });
    await routingStarted;
    expect(selectors).toContainEqual({ label: 'production' });

    labelTarget = 'sub-v2';
    releaseRouting();
    await expect(run).resolves.toMatchObject({ text: 'done' });

    expect(subV1.doGenerate).toHaveBeenCalledOnce();
    expect(subV2.doGenerate).not.toHaveBeenCalled();
    expect(selectors.filter(selector => 'label' in (selector as Record<string, unknown>))).toEqual([
      { label: 'production' },
    ]);
  });
});
