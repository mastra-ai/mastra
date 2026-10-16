import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../mastra';
import { MASTRA_VERSIONS_KEY, RequestContext } from '../request-context';
import { Agent } from './agent';
import {
  assertAgentVersionPinsOwnerIntegrity,
  assertContinuationVersionOverrides,
  assertContinuationSelectorMatchesPin,
  exactVersionOverridesForPins,
  MASTRA_AGENT_VERSION_PINS_DELEGATED_KEY,
  getAgentVersionPins,
  normalizeAgentVersionPins,
  reconcileAgentVersionPinPayloads,
  resolveLegacyContinuationRootPin,
  scopeAgentVersionPins,
  setAgentVersionPins,
} from './version-pins';

function model() {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      content: [{ type: 'text' as const, text: 'ok' }],
      finishReason: 'stop' as const,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      warnings: [],
    }),
  });
}

describe('agent version pins', () => {
  it('preserves frozen code-agent membership through serialization and delegation', () => {
    const pins = normalizeAgentVersionPins({ resolvedAgentIds: ['root', 'child'] });
    expect(scopeAgentVersionPins(pins, 'child')).toEqual({ resolvedAgentIds: ['child', 'root'] });
    expect(exactVersionOverridesForPins(pins)).toEqual({});
    expect(reconcileAgentVersionPinPayloads(pins, JSON.parse(JSON.stringify(pins)))).toEqual(pins);
    expect(() => reconcileAgentVersionPinPayloads(pins, { resolvedAgentIds: ['root', 'late-child'] })).toThrowError(
      expect.objectContaining({ id: 'PINNED_VERSION_INVALID' }),
    );
    expect(() =>
      normalizeAgentVersionPins({
        root: { agentId: 'root', versionId: 'v1' },
        resolvedAgentIds: ['child'],
      }),
    ).toThrowError(expect.objectContaining({ id: 'PINNED_VERSION_INVALID' }));
    expect(() =>
      reconcileAgentVersionPinPayloads(
        { agents: { outside: { agentId: 'outside', versionId: 'v1' } } },
        { resolvedAgentIds: ['root'] },
      ),
    ).toThrowError(expect.objectContaining({ id: 'PINNED_VERSION_INVALID' }));
  });

  it('represents every frozen identity through the explicit per-agent map', () => {
    expect(
      exactVersionOverridesForPins({
        root: { agentId: 'root', versionId: 'root-v1', selectedLabel: 'candidate' },
        agents: { child: { agentId: 'child', versionId: 'child-v1', selectedLabel: 'candidate' } },
      }),
    ).toEqual({ agents: { root: { versionId: 'root-v1' }, child: { versionId: 'child-v1' } } });
  });

  it('rejects a mutable graph default on a continuation even if its label name is unchanged', () => {
    expect(() =>
      assertContinuationVersionOverrides(
        { defaultLabel: 'candidate' },
        { root: { agentId: 'root', versionId: 'root-v1', selectedLabel: 'candidate' } },
        'root',
      ),
    ).toThrowError(expect.objectContaining({ id: 'PINNED_VERSION_CONFLICT' }));
    expect(() => resolveLegacyContinuationRootPin({ defaultLabel: 'candidate' }, 'root')).toThrowError(
      expect.objectContaining({ id: 'PINNED_VERSION_REQUIRED' }),
    );
  });

  it('keeps an explicit sub-agent label immutable within a run and resolves it again for a new run', async () => {
    let labelTarget = 'sub-v1';
    const sub = new Agent({ id: 'sub-agent', name: 'sub', instructions: 'sub', model: model() });
    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'supervisor',
      model: model(),
      agents: { sub },
    });
    const mastra = new Mastra({ agents: { supervisor, sub } });
    const selectors: unknown[] = [];
    vi.spyOn(mastra as any, 'resolveVersionedAgent').mockImplementation(async (agent: Agent, selector: any) => {
      selectors.push(selector);
      const fork = agent.__fork();
      fork.__setRawConfig({
        resolvedVersionId: typeof selector.versionId === 'string' ? selector.versionId : labelTarget,
        ...(typeof selector.label === 'string' ? { selectedVersionLabel: selector.label } : {}),
      });
      return fork;
    });
    const requestContext = new RequestContext();
    const versions = { agents: { 'sub-agent': { label: 'production' as const } } };

    await supervisor.__resolveExplicitAgentVersionPins({ requestContext, versions });
    labelTarget = 'sub-v2';
    await supervisor.__resolveExplicitAgentVersionPins({ requestContext, versions });
    expect(getAgentVersionPins(requestContext)?.agents?.['sub-agent']).toEqual({
      agentId: 'sub-agent',
      versionId: 'sub-v1',
      selectedLabel: 'production',
    });
    expect(selectors).toEqual([{ label: 'production' }, { versionId: 'sub-v1' }]);

    setAgentVersionPins(requestContext, undefined);
    await supervisor.__resolveExplicitAgentVersionPins({ requestContext, versions });
    expect(getAgentVersionPins(requestContext)?.agents?.['sub-agent']?.versionId).toBe('sub-v2');
    expect(selectors).toEqual([{ label: 'production' }, { versionId: 'sub-v1' }, { label: 'production' }]);
  });

  it('fails closed for corrupt pins and mutable or different continuation selectors', () => {
    expect(() => normalizeAgentVersionPins({ root: { agentId: 'agent' } })).toThrowError(
      expect.objectContaining({ id: 'PINNED_VERSION_INVALID' }),
    );
    const pin = { agentId: 'agent', versionId: 'v1', selectedLabel: 'production' };
    for (const duplicate of [
      { ...pin, versionId: 'v2' },
      { ...pin, selectedLabel: 'candidate' },
    ]) {
      expect(() => normalizeAgentVersionPins({ root: pin, agents: { agent: duplicate } })).toThrowError(
        expect.objectContaining({ id: 'PINNED_VERSION_INVALID' }),
      );
    }
    expect(() => assertContinuationSelectorMatchesPin({ label: 'production' }, pin)).toThrowError(
      expect.objectContaining({ id: 'PINNED_VERSION_CONFLICT' }),
    );
    expect(() => assertContinuationSelectorMatchesPin({ status: 'published' }, pin)).toThrowError(
      expect.objectContaining({ id: 'PINNED_VERSION_CONFLICT' }),
    );
    expect(() => assertContinuationSelectorMatchesPin({ versionId: 'v2' }, pin)).toThrowError(
      expect.objectContaining({ id: 'PINNED_VERSION_CONFLICT' }),
    );
    expect(() => assertContinuationSelectorMatchesPin({ versionId: 'v1' }, pin)).not.toThrow();
  });

  it('reconciles compatible persisted pin copies and rejects every conflicting field', () => {
    expect(
      reconcileAgentVersionPinPayloads(
        {
          root: { agentId: 'root', versionId: 'root-v1' },
          agents: { dep: { agentId: 'dep', versionId: 'dep-v1' } },
        },
        {
          root: { agentId: 'root', versionId: 'root-v1', selectedLabel: 'production' },
          agents: { dep: { agentId: 'dep', versionId: 'dep-v1', selectedLabel: 'stable' } },
          defaultStatus: 'published',
        },
      ),
    ).toEqual({
      root: { agentId: 'root', versionId: 'root-v1', selectedLabel: 'production' },
      agents: { dep: { agentId: 'dep', versionId: 'dep-v1', selectedLabel: 'stable' } },
      defaultStatus: 'published',
    });

    for (const conflicting of [
      { root: { agentId: 'root', versionId: 'root-v2' } },
      { root: { agentId: 'root', versionId: 'root-v1', selectedLabel: 'candidate' } },
      { agents: { dep: { agentId: 'dep', versionId: 'dep-v2' } } },
      { agents: { dep: { agentId: 'dep', versionId: 'dep-v1', selectedLabel: 'candidate' } } },
      { defaultStatus: 'draft' },
    ]) {
      expect(() =>
        reconcileAgentVersionPinPayloads(
          {
            root: { agentId: 'root', versionId: 'root-v1', selectedLabel: 'production' },
            agents: { dep: { agentId: 'dep', versionId: 'dep-v1', selectedLabel: 'stable' } },
            defaultStatus: 'published',
          },
          conflicting,
        ),
      ).toThrowError(expect.objectContaining({ id: 'PINNED_VERSION_INVALID' }));
    }
  });

  it('rejects a rootless persisted owner dependency while preserving scoped delegation', () => {
    expect(() =>
      assertAgentVersionPinsOwnerIntegrity({ agents: { root: { agentId: 'root', versionId: 'root-v1' } } }, 'root'),
    ).toThrowError(expect.objectContaining({ id: 'PINNED_VERSION_INVALID' }));

    const scoped = scopeAgentVersionPins({ agents: { child: { agentId: 'child', versionId: 'child-v1' } } }, 'child');
    expect(() => assertAgentVersionPinsOwnerIntegrity(scoped, 'child')).not.toThrow();
    expect(scoped?.root).toEqual({ agentId: 'child', versionId: 'child-v1' });
  });

  it('lets an explicit root selector override a graph label inherited from Mastra', async () => {
    const root = new Agent({ id: 'root', name: 'root', instructions: 'root', model: model() });
    const mastra = new Mastra({
      agents: { root },
      versions: { defaultLabel: 'production' },
    });
    const resolve = vi.spyOn(mastra, 'resolveVersionedAgent').mockImplementation(async (agent, selector) => {
      const fork = agent.__fork();
      fork.__setRawConfig({ resolvedVersionId: selector.versionId });
      fork.__markStoredVersionApplied();
      return fork;
    });

    await expect(
      root.generate('start', { versions: { agents: { root: { versionId: 'v2' } } } }),
    ).resolves.toMatchObject({ text: 'ok' });
    expect(resolve).toHaveBeenCalledWith(root, { versionId: 'v2' });
    expect(resolve.mock.calls.every(([, selector]) => selector.versionId === 'v2')).toBe(true);
  });

  it.each([
    [
      'same exact dependency and persisted default',
      { agents: { dep: { versionId: 'dep-v1' } }, defaultStatus: 'published' },
      false,
    ],
    ['a new root selector', { agents: { root: { versionId: 'root-v1' } } }, true],
    ['a new dependency selector', { agents: { other: { versionId: 'other-v1' } } }, true],
    ['a mutable dependency selector', { agents: { dep: { label: 'production' } } }, true],
    ['a different exact dependency', { agents: { dep: { versionId: 'dep-v2' } } }, true],
    ['a changed default status', { defaultStatus: 'draft' }, true],
  ] as const)('validates rootless structured pins: %s', (_name, overrides, shouldReject) => {
    const pins = {
      agents: { dep: { agentId: 'dep', versionId: 'dep-v1', selectedLabel: 'production' } },
      defaultStatus: 'published' as const,
    };
    const run = () => assertContinuationVersionOverrides(overrides, pins, 'root');
    if (shouldReject) {
      expect(run).toThrowError(expect.objectContaining({ id: 'PINNED_VERSION_CONFLICT' }));
    } else {
      expect(run).not.toThrow();
    }
  });

  it.each([
    ['exact root bridge', { agents: { root: { versionId: 'root-v1' } } }, false],
    ['root label', { agents: { root: { label: 'production' } } }, true],
    ['root status', { agents: { root: { status: 'published' } } }, true],
    ['dependency exact selector', { agents: { dep: { versionId: 'dep-v1' } } }, true],
    ['dependency label', { agents: { dep: { label: 'production' } } }, true],
    ['dependency default', { defaultStatus: 'published' }, true],
  ] as const)('validates no-pin legacy continuations: %s', (_name, overrides, shouldReject) => {
    const run = () => resolveLegacyContinuationRootPin(overrides, 'root');
    if (shouldReject) {
      expect(run).toThrowError(expect.objectContaining({ id: 'PINNED_VERSION_REQUIRED' }));
    } else {
      expect(run()).toEqual({ agentId: 'root', versionId: 'root-v1' });
    }
  });

  it('resolves explicit selectors recursively and scopes inherited pins to the delegated child', async () => {
    let labelTarget = 'leaf-v1';
    const leaf = new Agent({ id: 'leaf', name: 'leaf', instructions: 'leaf', model: model() });
    const middle = new Agent({
      id: 'middle',
      name: 'middle',
      instructions: 'middle',
      model: model(),
      agents: { leaf },
    });
    const root = new Agent({ id: 'root', name: 'root', instructions: 'root', model: model(), agents: { middle } });
    const mastra = new Mastra({ agents: { root, middle, leaf } });
    const selectors: unknown[] = [];
    vi.spyOn(mastra as any, 'resolveVersionedAgent').mockImplementation(async (agent: Agent, selector: any) => {
      selectors.push({ agentId: agent.id, selector });
      const fork = agent.__fork();
      fork.__setRawConfig({
        resolvedVersionId: typeof selector.versionId === 'string' ? selector.versionId : labelTarget,
        ...(typeof selector.label === 'string' ? { selectedVersionLabel: selector.label } : {}),
      });
      return fork;
    });
    const requestContext = new RequestContext();

    await root.__resolveExplicitAgentVersionPins({
      requestContext,
      versions: { agents: { leaf: { label: 'production' } } },
    });
    labelTarget = 'leaf-v2';

    expect(selectors).toEqual([{ agentId: 'leaf', selector: { label: 'production' } }]);
    expect(scopeAgentVersionPins(getAgentVersionPins(requestContext), 'middle')).toEqual({
      agents: {
        leaf: { agentId: 'leaf', versionId: 'leaf-v1', selectedLabel: 'production' },
      },
      resolvedAgentIds: ['leaf', 'middle', 'root'],
    });
    expect(scopeAgentVersionPins(getAgentVersionPins(requestContext), 'leaf')?.root).toEqual({
      agentId: 'leaf',
      versionId: 'leaf-v1',
      selectedLabel: 'production',
    });
  });

  it('does not copy a selected parent root onto an unversioned child', () => {
    expect(
      scopeAgentVersionPins({ root: { agentId: 'root', versionId: 'root-v1', selectedLabel: 'production' } }, 'middle'),
    ).toEqual({ agents: { root: { agentId: 'root', versionId: 'root-v1', selectedLabel: 'production' } } });
  });

  it('lets a selected parent delegate to an unversioned child without treating the parent pin as the child root', async () => {
    const child = new Agent({ id: 'child', name: 'child', instructions: 'child', model: model() });
    const parent = new Agent({
      id: 'parent',
      name: 'parent',
      instructions: 'parent',
      model: model(),
      agents: { child },
    });
    void new Mastra({ agents: { parent, child } });
    const requestContext = new RequestContext();
    setAgentVersionPins(requestContext, {
      root: { agentId: 'parent', versionId: 'parent-v1', selectedLabel: 'production' },
    });
    requestContext.set(MASTRA_AGENT_VERSION_PINS_DELEGATED_KEY, true);

    await expect((child as any).generate('continue', { requestContext })).resolves.toMatchObject({ text: 'ok' });
    expect(getAgentVersionPins(requestContext)).toEqual({
      agents: { parent: { agentId: 'parent', versionId: 'parent-v1', selectedLabel: 'production' } },
    });
  });

  it('hydrates a recursively pinned grandchild by exact ID after its label moves', async () => {
    let labelTarget = 'leaf-v1';
    const leaf = new Agent({ id: 'leaf', name: 'leaf', instructions: 'leaf', model: model() });
    const middle = new Agent({
      id: 'middle',
      name: 'middle',
      instructions: 'middle',
      model: model(),
      agents: { leaf },
    });
    const root = new Agent({ id: 'root', name: 'root', instructions: 'root', model: model(), agents: { middle } });
    const mastra = new Mastra({ agents: { root, middle, leaf } });
    const selectors: Array<{ agentId: string; selector: any }> = [];
    vi.spyOn(mastra as any, 'resolveVersionedAgent').mockImplementation(async (agent: Agent, selector: any) => {
      selectors.push({ agentId: agent.id, selector });
      const fork = agent.__fork();
      fork.__setRawConfig({
        resolvedVersionId: typeof selector.versionId === 'string' ? selector.versionId : labelTarget,
        ...(typeof selector.label === 'string' ? { selectedVersionLabel: selector.label } : {}),
      });
      return fork;
    });
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_VERSIONS_KEY, { agents: { leaf: { label: 'production' } } });
    await root.__resolveExplicitAgentVersionPins({
      requestContext,
      versions: { agents: { leaf: { label: 'production' } } },
    });
    expect(selectors).toEqual([{ agentId: 'leaf', selector: { label: 'production' } }]);

    labelTarget = 'leaf-v2';
    selectors.length = 0;
    requestContext.set(MASTRA_AGENT_VERSION_PINS_DELEGATED_KEY, true);
    await (middle as any).generate('continue', { requestContext });

    expect(selectors.length).toBeGreaterThan(0);
    expect(selectors.every(call => call.agentId === 'leaf' && call.selector.versionId === 'leaf-v1')).toBe(true);
    expect(getAgentVersionPins(requestContext)?.agents?.leaf).toEqual({
      agentId: 'leaf',
      versionId: 'leaf-v1',
      selectedLabel: 'production',
    });
  });
});
