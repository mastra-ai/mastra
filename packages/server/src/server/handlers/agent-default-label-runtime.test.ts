import { Agent } from '@mastra/core/agent';
import type { VersionOverrides, VersionSelector } from '@mastra/core/di';
import { Mastra } from '@mastra/core/mastra';
import { MASTRA_VERSIONS_KEY } from '@mastra/core/request-context';
import type { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import { describe, expect, it, vi } from 'vitest';

import { HTTPException } from '../http-exception';
import { AGENT_VERSION_PINS_CONTEXT_KEY, GENERATE_AGENT_ROUTE, GENERATE_LEGACY_ROUTE } from './agents';
import { createTestServerContext } from './test-utils';

async function createRuntime(
  versions?: VersionOverrides,
  agentVersions?: VersionOverrides | ((requestContext: RequestContext) => VersionOverrides),
  modelVersion: 'v1' | 'v2' = 'v2',
) {
  const storage = new InMemoryStore();
  let includeChild = true;
  const defaultOptions =
    typeof agentVersions === 'function'
      ? ({ requestContext }: { requestContext: RequestContext }) => ({ versions: agentVersions(requestContext) })
      : agentVersions
        ? { versions: agentVersions }
        : undefined;
  const child = new Agent({
    id: 'graph-child',
    name: 'Graph child',
    instructions: 'code-child',
    model: createMockModel({ mockText: 'code-child', version: modelVersion }),
  });
  const root = new Agent({
    id: 'graph-root',
    name: 'Graph root',
    instructions: 'code-root',
    model: createMockModel({ mockText: 'code-root', version: modelVersion }),
    agents: () => (includeChild ? { child } : {}),
    defaultOptions,
    defaultGenerateOptionsLegacy: defaultOptions,
    defaultStreamOptionsLegacy: defaultOptions,
  });
  const mastra = new Mastra({ logger: false, storage, agents: { root, child }, versions });
  const agentsStore = await storage.getStore('agents');

  // Keep real Core execution and InMemory selector resolution. The editor seam
  // only substitutes a mock model for the stored model's external provider.
  const applyStoredOverrides = vi.fn(async (agent: Agent, selector?: VersionSelector) => {
    const resolved = await agentsStore.getByIdResolved(agent.id, selector);
    if (!resolved) return agent;
    const instructions = typeof resolved.instructions === 'string' ? resolved.instructions : '';
    const fork = new Agent({
      id: agent.id,
      name: resolved.name,
      instructions,
      model: createMockModel({ mockText: instructions, version: modelVersion }),
      agents: () => agent.listAgents(),
      defaultOptions: agent.id === 'graph-root' ? defaultOptions : undefined,
      defaultGenerateOptionsLegacy: agent.id === 'graph-root' ? defaultOptions : undefined,
      defaultStreamOptionsLegacy: agent.id === 'graph-root' ? defaultOptions : undefined,
    });
    fork.__setRawConfig({ ...resolved });
    fork.__registerMastra(mastra);
    return fork;
  });
  vi.spyOn(mastra, 'getEditor').mockReturnValue({ agent: { applyStoredOverrides } } as never);

  async function publish(agentId: string, instruction: string) {
    await agentsStore.create({
      agent: {
        id: agentId,
        name: agentId,
        instructions: instruction,
        model: { provider: 'test', name: 'mock' },
      },
    });
    const version = await agentsStore.getLatestVersion(agentId);
    if (!version) throw new Error('Expected a stored version');
    await agentsStore.update({ id: agentId, status: 'published', activeVersionId: version.id });
    return version.id;
  }

  async function candidate(agentId: string, instruction: string) {
    const version = await agentsStore.createVersion({
      id: crypto.randomUUID(),
      agentId,
      versionNumber: 2,
      name: agentId,
      instructions: instruction,
      model: { provider: 'test', name: 'mock' },
    });
    await agentsStore.versionLabels!.set({
      entityType: 'agent',
      entityId: agentId,
      label: 'candidate',
      versionId: version.id,
      expectedRevisionToken: null,
    });
    return version.id;
  }

  return {
    mastra,
    applyStoredOverrides,
    publish,
    candidate,
    context: () => createTestServerContext({ mastra }),
    setIncludeChild: (value: boolean) => {
      includeChild = value;
    },
  };
}

function continuation(result: unknown): { versions: VersionOverrides; versionContinuationToken: string } {
  const metadata = (
    result as {
      resolvedVersionOverrides?: VersionOverrides & { rootUnversioned?: true; versionContinuationToken?: string };
    }
  ).resolvedVersionOverrides;
  expect(metadata?.versionContinuationToken).toEqual(expect.any(String));
  if (!metadata?.versionContinuationToken) throw new Error('Expected graph continuation metadata');
  const { versionContinuationToken, rootUnversioned: _rootUnversioned, ...versions } = metadata;
  return { versions, versionContinuationToken };
}

describe('registered agent graph versioning over HTTP', () => {
  // Core prepares legacy version pins before evaluating method defaults.
  it.todo('applies defaultGenerateOptionsLegacy.versions before resolving the root version');

  it('preserves legacy dynamic context and explicit selector precedence', async () => {
    const evaluateDefaults = vi.fn(
      (_requestContext: RequestContext): VersionOverrides => ({ agents: { 'graph-root': { status: 'draft' } } }),
    );
    const runtime = await createRuntime(undefined, evaluateDefaults, 'v1');
    const rootVersionId = await runtime.publish('graph-root', 'published-root');
    await runtime.candidate('graph-root', 'draft-root');
    const context = runtime.context();

    const result = await GENERATE_LEGACY_ROUTE.handler({
      ...context,
      agentId: 'graph-root',
      messages: 'Use the legacy root selection',
      versions: { agents: { 'graph-root': { versionId: rootVersionId } } },
    });

    expect(result.text).toBe('published-root');
    expect(evaluateDefaults).toHaveBeenCalledExactlyOnceWith(context.requestContext);
  });

  it('evaluates dynamic agent defaults once with the original HTTP request context', async () => {
    const evaluateDefaults = vi.fn((_requestContext: RequestContext) => ({ defaultLabel: 'candidate' }));
    const runtime = await createRuntime(undefined, evaluateDefaults);
    await runtime.publish('graph-root', 'published-root');
    await runtime.candidate('graph-root', 'candidate-root');
    await runtime.publish('graph-child', 'published-child');
    await runtime.candidate('graph-child', 'candidate-child');
    const context = runtime.context();
    context.requestContext.set('tenant', 'original-tenant');

    const result = await GENERATE_AGENT_ROUTE.handler({
      ...context,
      agentId: 'graph-root',
      messages: 'Use dynamic defaults',
    });

    expect(result.text).toBe('candidate-root');
    expect(evaluateDefaults).toHaveBeenCalledExactlyOnceWith(context.requestContext);
    expect(context.requestContext.get('tenant')).toBe('original-tenant');
  });

  it.each(['Mastra', 'agent defaultOptions'] as const)(
    'honors %s graph defaults before freezing an implicit HTTP root selection',
    async source => {
      const runtime = await createRuntime(
        source === 'Mastra' ? { defaultLabel: 'candidate' } : undefined,
        source === 'agent defaultOptions' ? { defaultLabel: 'candidate' } : undefined,
      );
      await runtime.publish('graph-root', 'published-root');
      const rootVersionId = await runtime.candidate('graph-root', 'candidate-root');
      await runtime.publish('graph-child', 'published-child');
      const childVersionId = await runtime.candidate('graph-child', 'candidate-child');
      const context = runtime.context();

      const result = await GENERATE_AGENT_ROUTE.handler({
        ...context,
        agentId: 'graph-root',
        messages: 'Use the configured graph default',
      });

      expect(result.text).toBe('candidate-root');
      expect(context.requestContext.get(AGENT_VERSION_PINS_CONTEXT_KEY)).toMatchObject({
        root: { agentId: 'graph-root', versionId: rootVersionId },
        agents: { 'graph-child': { agentId: 'graph-child', versionId: childVersionId } },
      });
    },
  );

  it.each(['body', 'request context', 'Mastra defaults'] as const)(
    'keeps an explicit query root ahead of a default label from %s',
    async source => {
      const runtime = await createRuntime(source === 'Mastra defaults' ? { defaultLabel: 'candidate' } : undefined);
      const rootVersionId = await runtime.publish('graph-root', 'stored-root-one');
      await runtime.candidate('graph-root', 'stored-root-two');
      await runtime.publish('graph-child', 'stored-child-one');
      const childVersionId = await runtime.candidate('graph-child', 'stored-child-two');
      const context = runtime.context();
      if (source === 'request context') context.requestContext.set(MASTRA_VERSIONS_KEY, { defaultLabel: 'candidate' });

      const result = await GENERATE_AGENT_ROUTE.handler({
        ...context,
        agentId: 'graph-root',
        messages: 'Run the selected graph',
        versionId: rootVersionId,
        ...(source === 'body' ? { versions: { defaultLabel: 'candidate' } } : {}),
      });

      expect(result.text).toBe('stored-root-one');
      expect(context.requestContext.get(AGENT_VERSION_PINS_CONTEXT_KEY)).toMatchObject({
        root: { agentId: 'graph-root', versionId: rootVersionId },
        agents: { 'graph-child': { agentId: 'graph-child', versionId: childVersionId } },
        resolvedAgentIds: ['graph-child', 'graph-root'],
      });
      expect(continuation(result).versions.agents?.['graph-root']).toEqual({ versionId: rootVersionId });
    },
  );

  it('keeps an explicit HTTP root ahead of the agent defaultOptions root selector', async () => {
    const runtime = await createRuntime(undefined, { agents: { 'graph-root': { status: 'draft' } } });
    const rootVersionId = await runtime.publish('graph-root', 'published-root');
    await runtime.candidate('graph-root', 'draft-root');

    const result = await GENERATE_AGENT_ROUTE.handler({
      ...runtime.context(),
      agentId: 'graph-root',
      messages: 'Use the explicitly requested root version',
      versions: { agents: { 'graph-root': { versionId: rootVersionId } } },
    });

    expect(result.text).toBe('published-root');
    expect(continuation(result).versions.agents?.['graph-root']).toEqual({ versionId: rootVersionId });
  });

  it('preserves a code-only graph after stored overrides appear between recursive turns', async () => {
    const runtime = await createRuntime();
    const first = await GENERATE_AGENT_ROUTE.handler({
      ...runtime.context(),
      agentId: 'graph-root',
      messages: 'First client-tool turn',
    });
    expect(first.text).toBe('code-root');
    const frozen = continuation(first);
    expect(frozen.versions).toEqual({});

    await runtime.publish('graph-root', 'newly-published-root');
    await runtime.publish('graph-child', 'newly-published-child');
    runtime.applyStoredOverrides.mockClear();
    const nextContext = runtime.context();
    const next = await GENERATE_AGENT_ROUTE.handler({
      ...nextContext,
      agentId: 'graph-root',
      messages: 'Continue with the client-tool result',
      ...frozen,
    });
    expect(next.text).toBe('code-root');
    expect(runtime.applyStoredOverrides).not.toHaveBeenCalled();
    expect(nextContext.requestContext.get(AGENT_VERSION_PINS_CONTEXT_KEY)).toEqual({
      resolvedAgentIds: ['graph-child', 'graph-root'],
    });
    expect(continuation(next)).toEqual(frozen);

    const fresh = await GENERATE_AGENT_ROUTE.handler({
      ...runtime.context(),
      agentId: 'graph-root',
      messages: 'Start a new run',
    });
    expect(fresh.text).toBe('newly-published-root');
  });

  it('preserves an unversioned dependency when the root has an exact version', async () => {
    const runtime = await createRuntime();
    const rootVersionId = await runtime.publish('graph-root', 'stored-root');
    const first = await GENERATE_AGENT_ROUTE.handler({
      ...runtime.context(),
      agentId: 'graph-root',
      messages: 'First client-tool turn',
      versions: { agents: { 'graph-root': { versionId: rootVersionId } }, defaultStatus: 'published' },
    });
    const frozen = continuation(first);
    await runtime.publish('graph-child', 'newly-published-child');
    runtime.applyStoredOverrides.mockClear();

    const nextContext = runtime.context();
    const next = await GENERATE_AGENT_ROUTE.handler({
      ...nextContext,
      agentId: 'graph-root',
      messages: 'Continue with the client-tool result',
      ...frozen,
    });
    expect(next.text).toBe('stored-root');
    expect(runtime.applyStoredOverrides.mock.calls.every(([agent]) => agent.id === 'graph-root')).toBe(true);
    expect(nextContext.requestContext.get(AGENT_VERSION_PINS_CONTEXT_KEY)).toEqual({
      root: { agentId: 'graph-root', versionId: rootVersionId },
      defaultStatus: 'published',
      resolvedAgentIds: ['graph-child', 'graph-root'],
    });
    expect(continuation(next)).toEqual(frozen);
  });

  it('rejects a dependency introduced after the original graph was frozen', async () => {
    const runtime = await createRuntime();
    runtime.setIncludeChild(false);
    const first = await GENERATE_AGENT_ROUTE.handler({
      ...runtime.context(),
      agentId: 'graph-root',
      messages: 'First client-tool turn',
    });
    runtime.setIncludeChild(true);

    const error = await GENERATE_AGENT_ROUTE.handler({
      ...runtime.context(),
      agentId: 'graph-root',
      messages: 'Continue the original graph',
      ...continuation(first),
    }).catch(error => error);
    expect(error).toBeInstanceOf(HTTPException);
    expect(await (error as HTTPException).getResponse().json()).toMatchObject({
      error: { code: 'INVALID_VERSION_SELECTOR' },
    });
  });
});
