import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../../mastra';
import { MASTRA_VERSIONS_KEY, RequestContext } from '../../../request-context';
import { InMemoryStore } from '../../../storage';
import type { WorkflowRunState } from '../../../workflows/types';
import { Agent } from '../../agent';
import { MASTRA_AGENT_VERSION_PINS_DELEGATED_KEY, getAgentVersionPins, setAgentVersionPins } from '../../version-pins';
import { DurableStepIds } from '../constants';
import { DurableAgent } from '../durable-agent';
import { prepareForDurableExecution } from '../preparation';
import { globalRunRegistry } from '../run-registry';

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

function pinnedRecoverySnapshot(
  runId: string,
  agentId: string,
  status: WorkflowRunState['status'] = 'running',
): WorkflowRunState {
  return {
    runId,
    status,
    value: {},
    context: {
      input: {
        __workflowKind: 'durable-agent',
        runId,
        agentId,
        messageListState: { memoryInfo: { threadId: `${runId}-thread`, resourceId: 'resource' } },
        requestContextEntries: { [MASTRA_VERSIONS_KEY]: { defaultStatus: 'published' } },
        modelConfig: { provider: 'mock', modelId: 'mock-v1' },
        state: { threadId: `${runId}-thread`, resourceId: 'resource' },
        agentVersionPins: {
          root: { agentId, versionId: 'v1', selectedLabel: 'production' },
        },
      },
    },
    activePaths: [],
    activeStepsPath: {},
    suspendedPaths: {},
    resumeLabels: {},
    serializedStepGraph: [],
    waitingPaths: {},
    timestamp: Date.now(),
  } as WorkflowRunState;
}

function legacyRecoverySnapshot(
  runId: string,
  agentId: string,
  status: WorkflowRunState['status'],
  spanVersionId?: string,
): WorkflowRunState {
  const snapshot = pinnedRecoverySnapshot(runId, agentId, status);
  const input = snapshot.context!.input as any;
  delete input.agentVersionPins;
  input.requestContextEntries = spanVersionId
    ? {
        [MASTRA_VERSIONS_KEY]: {
          self: { label: 'production' },
          defaultStatus: 'published',
        },
      }
    : {};
  if (spanVersionId) input.agentSpanData = { metadata: { entityVersionId: spanVersionId } };
  return snapshot;
}

async function persistRecoverySnapshot(store: InMemoryStore, snapshot: WorkflowRunState) {
  const workflows = (await store.getStore('workflows'))!;
  await workflows.persistWorkflowSnapshot({
    workflowName: DurableStepIds.AGENTIC_LOOP,
    runId: snapshot.runId,
    resourceId: 'resource',
    snapshot,
  });
}

describe('durable agent version pins', () => {
  it('rehydrates a label-selected root by its original exact ID after the label moves', async () => {
    let labelTarget = 'v1';
    const inner = new Agent({ id: 'durable', name: 'durable', instructions: 'test', model: model() });
    const durable = new DurableAgent({ agent: inner });
    const mastra = new Mastra({ agents: { durable } });
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

    const first = await prepareForDurableExecution({
      agent: durable.__getDurableExecutionAgent(),
      versionResolutionAgent: durable as any,
      durableAgentId: durable.id,
      durableAgentName: durable.name,
      messages: 'start',
      options: { versions: { self: { label: 'production' } } },
      mastra,
    });
    expect(first.workflowInput.agentVersionPins?.root).toEqual({
      agentId: 'durable',
      versionId: 'v1',
      selectedLabel: 'production',
    });
    expect(first.workflowInput.requestContextEntries?.mastra__versions).toEqual({ defaultStatus: 'published' });

    labelTarget = 'v2';
    selectors.length = 0;
    const restoredContext = new RequestContext(
      Object.entries(first.workflowInput.requestContextEntries ?? {}) as Iterable<readonly [string, unknown]>,
    );
    const recovered = await prepareForDurableExecution({
      agent: durable.__getDurableExecutionAgent(),
      versionResolutionAgent: durable as any,
      durableAgentId: durable.id,
      durableAgentName: durable.name,
      messages: [],
      requestContext: restoredContext,
      versionPins: first.workflowInput.agentVersionPins,
      mastra,
    });

    expect(selectors).toEqual([{ versionId: 'v1' }]);
    expect(recovered.workflowInput.agentVersionPins?.root).toEqual(first.workflowInput.agentVersionPins?.root);
    await expect(
      prepareForDurableExecution({
        agent: durable.__getDurableExecutionAgent(),
        versionResolutionAgent: durable as any,
        durableAgentId: durable.id,
        messages: [],
        options: { versions: { self: { label: 'production' } } },
        versionPins: first.workflowInput.agentVersionPins,
        mastra,
      }),
    ).rejects.toMatchObject({ id: 'PINNED_VERSION_CONFLICT' });
  });

  it('lets an explicit new-run selector replace an already resolved durable wrapper', async () => {
    const inner = new Agent({ id: 'durable', name: 'durable', instructions: 'test', model: model() });
    const durable = new DurableAgent({ agent: inner });
    const mastra = new Mastra({ agents: { durable } });
    vi.spyOn(mastra as any, 'resolveVersionedAgent').mockImplementation(async (agent: Agent, selector: any) => {
      const fork = agent.__fork();
      fork.__setRawConfig({ resolvedVersionId: selector.versionId });
      return fork;
    });
    const resolvedV1 = await (mastra as any).resolveVersionedAgent(durable, { versionId: 'v1' });

    const prepared = await prepareForDurableExecution({
      agent: resolvedV1.__getDurableExecutionAgent(),
      versionResolutionAgent: resolvedV1,
      durableAgentId: durable.id,
      messages: 'start',
      options: { versions: { self: { versionId: 'v2' } } },
      mastra,
    });

    expect(prepared.workflowInput.agentVersionPins?.root?.versionId).toBe('v2');
  });

  it('rejects root selector disagreement merged from Mastra defaults and a durable call before lookup', async () => {
    const inner = new Agent({ id: 'durable', name: 'durable', instructions: 'test', model: model() });
    const durable = new DurableAgent({ agent: inner });
    const mastra = new Mastra({
      agents: { durable },
      versions: { self: { label: 'production' } },
    });
    const resolve = vi.spyOn(mastra as any, 'resolveVersionedAgent');

    await expect(
      durable.prepare('start', { versions: { agents: { durable: { versionId: 'v2' } } } }),
    ).rejects.toMatchObject({ id: 'INVALID_VERSION_SELECTOR' });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('preserves delegated dependency pins in durable preparation and omits the internal marker from snapshots', async () => {
    const leaf = new Agent({ id: 'leaf', name: 'leaf', instructions: 'leaf', model: model() });
    const inner = new Agent({ id: 'middle', name: 'middle', instructions: 'middle', model: model(), agents: { leaf } });
    const durable = new DurableAgent({ agent: inner });
    const mastra = new Mastra({ agents: { middle: durable, leaf } });
    const selectors: unknown[] = [];
    vi.spyOn(mastra as any, 'resolveVersionedAgent').mockImplementation(async (agent: Agent, selector: any) => {
      selectors.push(selector);
      const fork = agent.__fork();
      fork.__setRawConfig({ resolvedVersionId: selector.versionId });
      return fork;
    });
    const requestContext = new RequestContext();
    setAgentVersionPins(requestContext, {
      root: { agentId: 'root', versionId: 'root-v1', selectedLabel: 'production' },
      agents: { leaf: { agentId: 'leaf', versionId: 'leaf-v1', selectedLabel: 'stable' } },
    });
    requestContext.set(MASTRA_AGENT_VERSION_PINS_DELEGATED_KEY, true);
    requestContext.set(MASTRA_VERSIONS_KEY, { agents: { leaf: { label: 'stable' } } });

    const prepared = await prepareForDurableExecution({
      agent: durable.__getDurableExecutionAgent(),
      versionResolutionAgent: durable as any,
      durableAgentId: durable.id,
      messages: 'start',
      requestContext,
      mastra,
    });

    expect(selectors.length).toBeGreaterThan(0);
    expect(selectors.every(selector => (selector as any).versionId === 'leaf-v1')).toBe(true);
    expect(prepared.workflowInput.agentVersionPins).toEqual({
      agents: { leaf: { agentId: 'leaf', versionId: 'leaf-v1', selectedLabel: 'stable' } },
    });
    expect(prepared.workflowInput.requestContextEntries).not.toHaveProperty(MASTRA_AGENT_VERSION_PINS_DELEGATED_KEY);
    expect(prepared.workflowInput.requestContextEntries?.[MASTRA_VERSIONS_KEY]).toEqual({
      agents: { leaf: { versionId: 'leaf-v1' } },
    });
  });

  it('rejects dependency selector conflicts from request context on warm and cold durable continuations', async () => {
    const leaf = new Agent({ id: 'leaf', name: 'leaf', instructions: 'leaf', model: model() });
    const inner = new Agent({ id: 'durable', name: 'durable', instructions: 'test', model: model(), agents: { leaf } });
    const durable = new DurableAgent({ agent: inner });
    const mastra = new Mastra({ agents: { durable, leaf } });
    vi.spyOn(mastra as any, 'resolveVersionedAgent').mockImplementation(async (agent: Agent, selector: any) => {
      const fork = agent.__fork();
      fork.__setRawConfig({ resolvedVersionId: selector.versionId ?? 'leaf-v1' });
      return fork;
    });
    const prepared = await durable.prepare('start', {
      versions: { agents: { leaf: { versionId: 'leaf-v1' } } },
    });
    const conflictingContext = new RequestContext();
    conflictingContext.set(MASTRA_VERSIONS_KEY, { agents: { leaf: { versionId: 'leaf-v2' } } });

    await expect(durable.resume(prepared.runId, {}, { requestContext: conflictingContext })).rejects.toMatchObject({
      id: 'PINNED_VERSION_CONFLICT',
    });
    await expect(
      durable.resume(prepared.runId, {}, { versions: { self: { versionId: 'durable-v1' } } }),
    ).rejects.toMatchObject({ id: 'PINNED_VERSION_CONFLICT' });
    await expect(
      durable.resume(prepared.runId, {}, { versions: { agents: { other: { versionId: 'other-v1' } } } }),
    ).rejects.toMatchObject({ id: 'PINNED_VERSION_CONFLICT' });
    await expect(
      durable.resume(prepared.runId, {}, { versions: { defaultStatus: 'published' } }),
    ).rejects.toMatchObject({ id: 'PINNED_VERSION_CONFLICT' });
    await expect(
      durable.resume(
        prepared.runId,
        {},
        {
          versions: {
            self: { versionId: 'durable-v1' },
            agents: { durable: { versionId: 'durable-v2' } },
          },
        },
      ),
    ).rejects.toMatchObject({ id: 'INVALID_VERSION_SELECTOR' });
    await expect(
      prepareForDurableExecution({
        agent: durable.__getDurableExecutionAgent(),
        versionResolutionAgent: durable as any,
        durableAgentId: durable.id,
        messages: [],
        requestContext: conflictingContext,
        versionPins: { agents: { leaf: { agentId: 'leaf', versionId: 'leaf-v1' } } },
        mastra,
      }),
    ).rejects.toMatchObject({ id: 'PINNED_VERSION_CONFLICT' });
  });

  it.each(['recover', 'recoverActiveRuns'] as const)(
    'hydrates the original exact root pin through real cold %s after its label moves',
    async recoveryMethod => {
      const runId = `cold-${recoveryMethod}`;
      const store = new InMemoryStore();
      const inner = new Agent({ id: 'durable', name: 'durable', instructions: 'test', model: model() });
      const durable = new DurableAgent({ agent: inner });
      const mastra = new Mastra({ agents: { durable }, storage: store });
      const selectors: unknown[] = [];
      const labelTarget = 'v2';
      vi.spyOn(mastra as any, 'resolveVersionedAgent').mockImplementation(async (agent: Agent, selector: any) => {
        selectors.push(selector);
        const executionAgent = (agent as any).__getDurableExecutionAgent?.() ?? agent;
        const fork = executionAgent.__fork();
        fork.__setRawConfig({
          resolvedVersionId: typeof selector.versionId === 'string' ? selector.versionId : labelTarget,
          ...(typeof selector.label === 'string' ? { selectedVersionLabel: selector.label } : {}),
        });
        return fork;
      });
      await persistRecoverySnapshot(store, pinnedRecoverySnapshot(runId, durable.id));
      const restart = vi.fn(async () => ({ status: 'success' as const }));
      vi.spyOn(durable, 'getWorkflow').mockReturnValue({
        createRun: vi.fn(async () => ({ runId, restart })),
        deleteWorkflowRunById: vi.fn(async () => {}),
      } as any);

      if (recoveryMethod === 'recover') {
        const recovered = await durable.recover(runId);
        await globalRunRegistry.get(runId)?.workflowExecution;
        expect(getAgentVersionPins(globalRunRegistry.get(runId)?.requestContext as RequestContext)?.root).toEqual({
          agentId: durable.id,
          versionId: 'v1',
          selectedLabel: 'production',
        });
        recovered.cleanup();
      } else {
        await expect(durable.recoverActiveRuns()).resolves.toMatchObject({ succeeded: 1, failed: 0 });
      }

      expect(selectors).toEqual([{ versionId: 'v1' }]);
      expect(restart).toHaveBeenCalledOnce();
    },
  );

  it('hydrates the original exact root pin through a real cold resume after its label moves', async () => {
    const runId = 'cold-resume';
    const store = new InMemoryStore();
    const inner = new Agent({ id: 'durable', name: 'durable', instructions: 'test', model: model() });
    const durable = new DurableAgent({ agent: inner });
    const mastra = new Mastra({ agents: { durable }, storage: store });
    const selectors: unknown[] = [];
    const movedLabelTarget = 'v2';
    vi.spyOn(mastra as any, 'resolveVersionedAgent').mockImplementation(async (agent: Agent, selector: any) => {
      selectors.push(selector);
      const executionAgent = (agent as any).__getDurableExecutionAgent?.() ?? agent;
      const fork = executionAgent.__fork();
      fork.__setRawConfig({
        resolvedVersionId: typeof selector.versionId === 'string' ? selector.versionId : movedLabelTarget,
        ...(typeof selector.label === 'string' ? { selectedVersionLabel: selector.label } : {}),
      });
      return fork;
    });
    await persistRecoverySnapshot(store, pinnedRecoverySnapshot(runId, durable.id, 'suspended'));
    const resume = vi.fn(async () => ({ status: 'success' as const }));
    vi.spyOn(durable, 'getWorkflow').mockReturnValue({
      createRun: vi.fn(async () => ({ runId, resume })),
      deleteWorkflowRunById: vi.fn(async () => {}),
    } as any);

    const resumed = await durable.resume(runId, { approved: true });
    await globalRunRegistry.get(runId)?.workflowExecution;

    expect(selectors).toEqual([{ versionId: 'v1' }]);
    expect(getAgentVersionPins(globalRunRegistry.get(runId)?.requestContext as RequestContext)?.root).toEqual({
      agentId: durable.id,
      versionId: 'v1',
      selectedLabel: 'production',
    });
    expect(resume).toHaveBeenCalledOnce();
    resumed.cleanup();
  });

  it.each(['resume', 'recover'] as const)(
    'promotes a legacy span entityVersionId for exact cold %s after its label moves',
    async method => {
      const runId = `legacy-span-${method}`;
      const store = new InMemoryStore();
      const inner = new Agent({ id: 'durable', name: 'durable', instructions: 'test', model: model() });
      const durable = new DurableAgent({ agent: inner });
      const mastra = new Mastra({ agents: { durable }, storage: store });
      const selectors: unknown[] = [];
      vi.spyOn(mastra as any, 'resolveVersionedAgent').mockImplementation(async (agent: Agent, selector: any) => {
        selectors.push(selector);
        const executionAgent = (agent as any).__getDurableExecutionAgent?.() ?? agent;
        const fork = executionAgent.__fork();
        fork.__setRawConfig({ resolvedVersionId: selector.versionId ?? 'v2' });
        return fork;
      });
      await persistRecoverySnapshot(
        store,
        legacyRecoverySnapshot(runId, durable.id, method === 'resume' ? 'suspended' : 'running', 'v1'),
      );
      const continueWorkflow = vi.fn(async () => ({ status: 'success' as const }));
      vi.spyOn(durable, 'getWorkflow').mockReturnValue({
        createRun: vi.fn(async () => ({
          runId,
          ...(method === 'resume' ? { resume: continueWorkflow } : { restart: continueWorkflow }),
        })),
        deleteWorkflowRunById: vi.fn(async () => {}),
      } as any);

      const result = method === 'resume' ? await durable.resume(runId, {}) : await durable.recover(runId);
      await globalRunRegistry.get(runId)?.workflowExecution;

      expect(selectors).toEqual([{ versionId: 'v1' }]);
      result.cleanup();
    },
  );

  it('rejects unsafe warm and cold legacy continuation selectors with no pin payload', async () => {
    const store = new InMemoryStore();
    const inner = new Agent({ id: 'durable', name: 'durable', instructions: 'test', model: model() });
    const durable = new DurableAgent({ agent: inner });
    void new Mastra({ agents: { durable }, storage: store });
    const warm = await durable.prepare('start');
    await expect(
      durable.resume(warm.runId, {}, { versions: { agents: { dep: { label: 'production' } } } }),
    ).rejects.toMatchObject({ id: 'PINNED_VERSION_REQUIRED' });
    await expect(durable.resume(warm.runId, {}, { versions: { defaultStatus: 'published' } })).rejects.toMatchObject({
      id: 'PINNED_VERSION_REQUIRED',
    });

    const coldRunId = 'legacy-no-pins';
    await persistRecoverySnapshot(store, legacyRecoverySnapshot(coldRunId, durable.id, 'suspended'));
    await expect(
      durable.resume(coldRunId, {}, { versions: { agents: { dep: { status: 'published' } } } }),
    ).rejects.toMatchObject({ id: 'PINNED_VERSION_REQUIRED' });
  });

  it('fails closed on cold resume when rootless structured pins meet a resolved durable wrapper', async () => {
    const runId = 'cold-rootless-pins';
    const store = new InMemoryStore();
    const inner = new Agent({ id: 'durable', name: 'durable', instructions: 'test', model: model() });
    const durable = new DurableAgent({ agent: inner });
    durable.__setRawConfig({ resolvedVersionId: 'v2' });
    void new Mastra({ agents: { durable }, storage: store });
    const snapshot = pinnedRecoverySnapshot(runId, durable.id, 'suspended');
    (snapshot.context!.input as any).agentVersionPins = { defaultStatus: 'published' };
    await persistRecoverySnapshot(store, snapshot);

    await expect(durable.resume(runId, {})).rejects.toMatchObject({ id: 'PINNED_VERSION_CONFLICT' });
  });

  it('rejects a rootless persisted durable owner dependency before stored-agent lookup', async () => {
    const runId = 'cold-owner-dependency';
    const store = new InMemoryStore();
    const inner = new Agent({ id: 'durable', name: 'durable', instructions: 'test', model: model() });
    const durable = new DurableAgent({ agent: inner });
    const mastra = new Mastra({ agents: { durable }, storage: store });
    const snapshot = pinnedRecoverySnapshot(runId, durable.id, 'suspended');
    (snapshot.context!.input as any).agentVersionPins = {
      agents: { durable: { agentId: 'durable', versionId: 'v1' } },
    };
    await persistRecoverySnapshot(store, snapshot);
    const resolve = vi.spyOn(mastra as any, 'resolveVersionedAgent');

    await expect(durable.resume(runId, {})).rejects.toMatchObject({ id: 'PINNED_VERSION_INVALID' });
    expect(resolve).not.toHaveBeenCalled();
  });
});
