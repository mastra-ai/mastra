import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
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
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 'text' },
        { type: 'text-delta', id: 'text', delta: 'ok' },
        { type: 'text-end', id: 'text' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
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
  it('pins the graph-wide default label before durable preparation and retains it after labels move', async () => {
    let labelVersion = 'v1';
    const leaf = new Agent({ id: 'leaf', name: 'leaf', instructions: 'leaf', model: model() });
    const inner = new Agent({ id: 'durable', name: 'durable', instructions: 'test', model: model(), agents: { leaf } });
    const durable = new DurableAgent({ agent: inner });
    const mastra = new Mastra({ agents: { durable, leaf } });
    const selectors: Array<{ agentId: string; selector: unknown }> = [];
    vi.spyOn(mastra as any, 'resolveVersionedAgent').mockImplementation(async (agent: Agent, selector: any) => {
      selectors.push({ agentId: agent.id, selector });
      const fork = agent.__fork();
      fork.__setRawConfig({
        resolvedVersionId: selector.versionId ?? `${agent.id}-${labelVersion}`,
        ...(selector.label ? { selectedVersionLabel: selector.label } : {}),
      });
      return fork;
    });

    const first = await durable.prepare('start', { versions: { defaultLabel: 'production' } });
    expect(first.workflowInput.agentVersionPins).toMatchObject({
      root: { agentId: 'durable', versionId: 'durable-v1', selectedLabel: 'production' },
      agents: { leaf: { agentId: 'leaf', versionId: 'leaf-v1', selectedLabel: 'production' } },
    });

    labelVersion = 'v2';
    selectors.length = 0;
    const recovered = await prepareForDurableExecution({
      agent: durable.__getDurableExecutionAgent(),
      versionResolutionAgent: durable as any,
      durableAgentId: durable.id,
      messages: [],
      requestContext: new RequestContext(Object.entries(first.workflowInput.requestContextEntries ?? {})),
      versionPins: first.workflowInput.agentVersionPins,
      mastra,
    });
    expect(recovered.workflowInput.agentVersionPins).toEqual(first.workflowInput.agentVersionPins);
    expect(selectors).toEqual(
      expect.arrayContaining([
        { agentId: 'durable', selector: { versionId: 'durable-v1' } },
        { agentId: 'leaf', selector: { versionId: 'leaf-v1' } },
      ]),
    );
    expect(selectors.every(({ selector }) => 'versionId' in (selector as object))).toBe(true);

    const next = await durable.prepare('next', { versions: { defaultLabel: 'production' } });
    expect(next.workflowInput.agentVersionPins).toMatchObject({
      root: { agentId: 'durable', versionId: 'durable-v2' },
      agents: { leaf: { agentId: 'leaf', versionId: 'leaf-v2' } },
    });
  });

  it('lets an explicit root selector override a graph-wide default label in durable preparation', async () => {
    const inner = new Agent({ id: 'durable', name: 'durable', instructions: 'test', model: model() });
    const durable = new DurableAgent({ agent: inner });
    const mastra = new Mastra({ agents: { durable }, versions: { defaultLabel: 'production' } });
    const resolve = vi
      .spyOn(mastra as any, 'resolveVersionedAgent')
      .mockImplementation(async (agent: Agent, selector: any) => {
        const fork = agent.__fork();
        fork.__setRawConfig({ resolvedVersionId: selector.versionId ?? 'production-v1' });
        return fork;
      });

    const prepared = await durable.prepare('start', {
      versions: { agents: { durable: { versionId: 'candidate-v2' } } },
    });
    expect(prepared.workflowInput.agentVersionPins?.root?.versionId).toBe('candidate-v2');
    expect(resolve).toHaveBeenCalledWith(expect.anything(), { versionId: 'candidate-v2' });
  });

  it.each(['prepare', 'stream', 'generate'] as const)(
    'replaces an agent-default exact selector atomically with a caller label in durable %s',
    async method => {
      const durable = new DurableAgent({
        agent: new Agent({
          id: 'durable',
          name: 'durable',
          instructions: 'test',
          model: model(),
          defaultOptions: { versions: { agents: { durable: { versionId: 'v1' } } } },
        }),
      });
      const mastra = new Mastra({ agents: { durable }, logger: false });
      const resolve = vi.spyOn(mastra, 'resolveVersionedAgent').mockImplementation(async (agent, selector) => {
        expect(selector).toEqual({ label: 'candidate' });
        const fork = agent.__fork();
        fork.__setRawConfig({ resolvedVersionId: 'v2' });
        return fork as typeof agent;
      });

      const result = await durable[method]('start', { versions: { agents: { durable: { label: 'candidate' } } } });
      if (method === 'prepare') {
        expect((result as any).workflowInput.agentVersionPins.root.versionId).toBe('v2');
      } else {
        const output = method === 'stream' ? await (result as any).output.getFullOutput() : result;
        expect(output.text).toBe('ok');
      }
      expect(resolve).toHaveBeenCalled();
    },
  );

  it('freezes the public durable root identity when its ID differs from the wrapped agent', async () => {
    const inner = new Agent({ id: 'inner', name: 'inner', instructions: 'test', model: model() });
    const durable = new DurableAgent<string>({ agent: inner, id: 'public' });
    const mastra = new Mastra({ agents: { durable } });
    vi.spyOn(mastra, 'resolveVersionedAgent').mockImplementation(async (agent, selector) => {
      const fork = agent.__fork();
      fork.__setRawConfig({ resolvedVersionId: selector.versionId ?? 'v1' });
      return fork as typeof agent;
    });

    const prepared = await durable.prepare('start', { versions: { defaultLabel: 'production' } });
    expect(prepared.workflowInput.agentVersionPins).toEqual({
      root: { agentId: 'public', versionId: 'v1', selectedLabel: 'production' },
      resolvedAgentIds: ['public'],
    });
  });

  it('rehydrates a label-selected root by its original exact ID after the label moves', async () => {
    let labelTarget = 'v1';
    const inner = new Agent({
      id: 'durable',
      name: 'durable',
      instructions: 'test',
      model: model(),
      inputProcessors: [
        {
          id: 'record-routing-context',
          processInput: ({ requestContext, messages }) => {
            requestContext?.set('routingStage', 'processed');
            return messages;
          },
        },
      ],
    });
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
      options: { versions: { agents: { durable: { label: 'production' } } } },
      mastra,
    });
    expect(first.workflowInput.agentVersionPins?.root).toEqual({
      agentId: 'durable',
      versionId: 'v1',
      selectedLabel: 'production',
    });
    expect(first.workflowInput.requestContextEntries?.mastra__versions).toEqual({
      agents: { durable: { versionId: 'v1' } },
    });
    expect(first.workflowInput.requestContextEntries?.routingStage).toBe('processed');

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
        options: { versions: { agents: { durable: { label: 'production' } } } },
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
      options: { versions: { agents: { durable: { versionId: 'v2' } } } },
      mastra,
    });

    expect(prepared.workflowInput.agentVersionPins?.root?.versionId).toBe('v2');
  });

  it('lets a call-site root label override the instance graph default in durable preparation', async () => {
    const inner = new Agent({ id: 'durable', name: 'durable', instructions: 'test', model: model() });
    const durable = new DurableAgent({ agent: inner });
    const mastra = new Mastra({
      agents: { durable },
      versions: { defaultLabel: 'production' },
    });
    const resolve = vi
      .spyOn(mastra as any, 'resolveVersionedAgent')
      .mockImplementation(async (agent: Agent, selector: any) => {
        const fork = agent.__fork();
        fork.__setRawConfig({ resolvedVersionId: 'candidate-v2', selectedVersionLabel: selector.label });
        return fork;
      });

    const prepared = await durable.prepare('start', { versions: { agents: { durable: { label: 'candidate' } } } });
    expect(prepared.workflowInput.agentVersionPins?.root).toEqual({
      agentId: 'durable',
      versionId: 'candidate-v2',
      selectedLabel: 'candidate',
    });
    expect(resolve).toHaveBeenCalledWith(expect.anything(), { label: 'candidate' });
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
      agents: {
        leaf: { agentId: 'leaf', versionId: 'leaf-v1', selectedLabel: 'stable' },
        root: { agentId: 'root', versionId: 'root-v1', selectedLabel: 'production' },
      },
    });
    expect(prepared.workflowInput.requestContextEntries).not.toHaveProperty(MASTRA_AGENT_VERSION_PINS_DELEGATED_KEY);
    expect(prepared.workflowInput.requestContextEntries?.[MASTRA_VERSIONS_KEY]).toEqual({
      agents: { leaf: { versionId: 'leaf-v1' }, root: { versionId: 'root-v1' } },
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
      durable.resume(prepared.runId, {}, { versions: { agents: { durable: { versionId: 'durable-v1' } } } }),
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
            defaultLabel: 'production',
            agents: { durable: { versionId: 'durable-v2' } },
          },
        },
      ),
    ).rejects.toMatchObject({ id: 'PINNED_VERSION_CONFLICT' });
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
    'retains every graph-default pin across a cold %s after the environment label moves',
    async method => {
      const runId = `default-label-cold-${method}`;
      let labelVersion = 'v1';
      const store = new InMemoryStore();
      const leaf = new Agent({ id: 'leaf', name: 'leaf', instructions: 'leaf', model: model() });
      const inner = new Agent({
        id: 'durable',
        name: 'durable',
        instructions: 'test',
        model: model(),
        agents: { leaf },
      });
      const durable = new DurableAgent({ agent: inner });
      const mastra = new Mastra({ agents: { durable, leaf }, storage: store });
      const selectors: Array<{ agentId: string; selector: any }> = [];
      vi.spyOn(mastra as any, 'resolveVersionedAgent').mockImplementation(async (agent: Agent, selector: any) => {
        selectors.push({ agentId: agent.id, selector });
        const executionAgent = (agent as any).__getDurableExecutionAgent?.() ?? agent;
        const fork = executionAgent.__fork();
        fork.__setRawConfig({
          resolvedVersionId: selector.versionId ?? `${agent.id}-${labelVersion}`,
          ...(selector.label ? { selectedVersionLabel: selector.label } : {}),
        });
        return fork;
      });
      const prepared = await prepareForDurableExecution({
        agent: durable.__getDurableExecutionAgent(),
        versionResolutionAgent: durable as any,
        durableAgentId: durable.id,
        messages: 'start',
        options: { versions: { defaultLabel: 'production' } },
        runId,
        mastra,
      });
      const snapshot = pinnedRecoverySnapshot(runId, durable.id, method === 'resume' ? 'suspended' : 'running');
      snapshot.context!.input = prepared.workflowInput;
      await persistRecoverySnapshot(store, snapshot);
      labelVersion = 'v2';
      selectors.length = 0;
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

      expect(getAgentVersionPins(globalRunRegistry.get(runId)?.requestContext as RequestContext)).toEqual(
        prepared.workflowInput.agentVersionPins,
      );
      expect(selectors).toEqual(
        expect.arrayContaining([
          { agentId: 'durable', selector: { versionId: 'durable-v1' } },
          { agentId: 'leaf', selector: { versionId: 'leaf-v1' } },
        ]),
      );
      expect(selectors.every(({ selector }) => typeof selector.versionId === 'string')).toBe(true);
      expect(continueWorkflow).toHaveBeenCalledOnce();
      result.cleanup();
    },
  );

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

  it('rejects conflicting historical root selector spellings without an authoritative pin', async () => {
    const runId = 'legacy-conflicting-root-selectors';
    const store = new InMemoryStore();
    const durable = new DurableAgent({
      agent: new Agent({ id: 'durable', name: 'durable', instructions: 'test', model: model() }),
    });
    const mastra = new Mastra({ agents: { durable }, storage: store });
    const snapshot = legacyRecoverySnapshot(runId, durable.id, 'suspended');
    (snapshot.context!.input as any).requestContextEntries = {
      [MASTRA_VERSIONS_KEY]: {
        self: { versionId: 'v1' },
        agents: { durable: { versionId: 'v2' } },
      },
    };
    await persistRecoverySnapshot(store, snapshot);
    const resolve = vi.spyOn(mastra, 'resolveVersionedAgent');

    await expect(durable.resume(runId, {})).rejects.toMatchObject({ id: 'PINNED_VERSION_INVALID' });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('allows inherited agent defaults on continuation but still rejects an explicit mutable selector', async () => {
    const durable = new DurableAgent({
      agent: new Agent({
        id: 'durable',
        name: 'durable',
        instructions: 'test',
        model: model(),
        defaultOptions: { versions: { defaultLabel: 'production' } },
      }),
    });
    const mastra = new Mastra({ agents: { durable } });
    vi.spyOn(mastra, 'resolveVersionedAgent').mockImplementation(async (agent, selector) => {
      const fork = agent.__fork();
      fork.__setRawConfig({ resolvedVersionId: selector.versionId ?? 'v2' });
      return fork as typeof agent;
    });
    const versionPins = { root: { agentId: 'durable', versionId: 'v1', selectedLabel: 'production' } };
    const continuation = {
      agent: durable.__getDurableExecutionAgent(),
      versionResolutionAgent: durable as any,
      durableAgentId: durable.id,
      messages: [],
      versionPins,
      mastra,
    };

    const prepared = await prepareForDurableExecution(continuation);
    expect(prepared.workflowInput.agentVersionPins).toEqual(versionPins);
    await expect(
      prepareForDurableExecution({
        ...continuation,
        options: { versions: { defaultLabel: 'production' } },
      }),
    ).rejects.toMatchObject({ id: 'PINNED_VERSION_CONFLICT' });
  });

  it.each(['stream', 'generate'] as const)(
    'preserves caller-selector validation after default options resolve for delegated durable %s',
    async method => {
      const durable = new DurableAgent({
        agent: new Agent({
          id: 'durable',
          name: 'durable',
          instructions: 'test',
          model: new MockLanguageModelV2({
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: 'text' },
                { type: 'text-delta', id: 'text', delta: 'pinned' },
                { type: 'text-end', id: 'text' },
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
              ]),
            }),
          }),
          defaultOptions: { versions: { defaultLabel: 'production' } },
        }),
      });
      const mastra = new Mastra({ agents: { durable }, logger: false });
      const resolve = vi.spyOn(mastra, 'resolveVersionedAgent').mockImplementation(async (agent, selector) => {
        const fork = agent.__fork();
        fork.__setRawConfig({ resolvedVersionId: selector.versionId ?? 'v2' });
        return fork as typeof agent;
      });
      const inheritedContext = () => {
        const requestContext = new RequestContext();
        setAgentVersionPins(requestContext, { root: { agentId: 'durable', versionId: 'v1' } });
        requestContext.set(MASTRA_AGENT_VERSION_PINS_DELEGATED_KEY, true);
        requestContext.set(MASTRA_VERSIONS_KEY, { agents: { durable: { versionId: 'v1' } } });
        return requestContext;
      };

      const result = await durable[method]('start', { requestContext: inheritedContext() });
      const output = method === 'stream' ? await (result as any).output.getFullOutput() : result;
      expect(output.text).toBe('pinned');
      expect(resolve.mock.calls.every(([, selector]) => selector.versionId === 'v1')).toBe(true);

      await expect(
        durable[method]('start', {
          requestContext: inheritedContext(),
          versions: { defaultLabel: 'production' },
        }),
      ).rejects.toMatchObject({ id: 'PINNED_VERSION_CONFLICT' });
    },
  );

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

  it('keeps a code-defined durable graph on code when resuming a persisted status policy', async () => {
    const leaf = new Agent({ id: 'leaf', name: 'leaf', instructions: 'leaf', model: model() });
    const inner = new Agent({ id: 'durable', name: 'durable', instructions: 'test', model: model(), agents: { leaf } });
    const durable = new DurableAgent({ agent: inner });
    const mastra = new Mastra({ agents: { durable, leaf } });
    const resolve = vi.spyOn(mastra as any, 'resolveVersionedAgent');

    const resumed = await prepareForDurableExecution({
      agent: durable.__getDurableExecutionAgent(),
      versionResolutionAgent: durable as any,
      durableAgentId: durable.id,
      messages: [],
      versionPins: { defaultStatus: 'published' },
      mastra,
    });

    expect(resumed.workflowInput.agentVersionPins).toEqual({ defaultStatus: 'published' });
    expect(resolve).not.toHaveBeenCalled();
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

  it.each(['resume', 'recover'] as const)('rejects a newly appearing graph dependency on cold %s', async method => {
    const runId = `late-dependency-${method}`;
    const store = new InMemoryStore();
    const late = new Agent({ id: 'late', name: 'late', instructions: 'late', model: model() });
    const durable = new DurableAgent({
      agent: new Agent({ id: 'durable', name: 'durable', instructions: 'test', model: model(), agents: { late } }),
    });
    const mastra = new Mastra({ agents: { durable, late }, storage: store, logger: false });
    vi.spyOn(mastra, 'resolveVersionedAgent').mockImplementation(async (agent, selector) => {
      const fork = agent.__fork();
      fork.__setRawConfig({ resolvedVersionId: selector.versionId });
      return fork as typeof agent;
    });
    const snapshot = pinnedRecoverySnapshot(runId, durable.id, method === 'resume' ? 'suspended' : 'running');
    (snapshot.context!.input as any).agentVersionPins.resolvedAgentIds = ['durable'];
    await persistRecoverySnapshot(store, snapshot);
    const continueWorkflow = vi.fn(async () => ({ status: 'success' as const }));
    vi.spyOn(durable, 'getWorkflow').mockReturnValue({
      createRun: vi.fn(async () => ({ runId, resume: continueWorkflow, restart: continueWorkflow })),
      deleteWorkflowRunById: vi.fn(async () => {}),
    } as any);

    await expect(method === 'resume' ? durable.resume(runId, {}) : durable.recover(runId)).rejects.toMatchObject({
      id: 'PINNED_VERSION_REQUIRED',
    });
    expect(continueWorkflow).not.toHaveBeenCalled();
  });
});
