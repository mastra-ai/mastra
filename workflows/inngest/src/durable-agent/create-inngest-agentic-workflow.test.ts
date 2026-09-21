import { createHash } from 'node:crypto';
import {
  DurableAgentDefaults,
  DurableStepIds,
  AGENT_CONTROL_TOPIC,
  globalRunRegistry,
  TOOL_PERMISSION_POLICY_KEY,
  TOOL_PERMISSION_POLICY_REQUIRED_KEY,
  TOOL_PERMISSION_POLICY_STABLE_KEY,
} from '@mastra/core/agent/durable';
import { createTerminalToolResultPartId, MessageList } from '@mastra/core/agent/message-list';
import type { AnyExportedSpan, ObservabilityExporter, TracingEvent } from '@mastra/core/observability';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import { PUBSUB_SYMBOL } from '@mastra/core/workflows/_constants';
import { Observability } from '@mastra/observability';
import { Inngest } from 'inngest';
import { describe, expect, it, vi } from 'vitest';

import {
  createInngestDurableAgenticWorkflow,
  createInngestDurableAgenticWorkflowIds,
  INNGEST_DURABLE_AGENT_PROTOCOL_VERSION,
  InngestDurableStepIds,
} from './create-inngest-agentic-workflow';

/**
 * Regression coverage for #19317: the Inngest durable engine must honor
 * `toolCallConcurrency` instead of always running tool calls sequentially.
 *
 * The tool-call foreach carries a concurrency *resolver* that derives the
 * effective concurrency at execution time from the serialized iteration state
 * (options + toolsMetadata). This keeps resolution safe across Inngest step
 * memoization/replay and across runs sharing the same workflow instance —
 * unlike a shared mutable options object.
 */

function nestedWorkflowSteps(entry: any): any[] | undefined {
  // Loop/foreach entries wrap their body in a SingleStepEntry, while plain
  // step entries hold nested workflows directly.
  const inner = entry.step?.executionGraph ? entry.step : entry.step?.step;
  return inner?.executionGraph?.steps;
}

function findEntry(steps: any[], predicate: (entry: any) => boolean): any {
  for (const entry of steps ?? []) {
    if (predicate(entry)) return entry;
    const inner = entry.step?.executionGraph ? entry.step : entry.step?.step;
    if (inner?.executionGraph) {
      const nested = findEntry(inner.executionGraph.steps, predicate);
      if (nested) return nested;
    }
    if (entry.steps) {
      const nested = findEntry(entry.steps, predicate);
      if (nested) return nested;
    }
  }
  return undefined;
}

function findForeachEntry(steps: any[]): any {
  for (const entry of steps ?? []) {
    if (entry.type === 'foreach') {
      return entry.step?.step ? { ...entry, step: entry.step.step } : entry;
    }
    const nestedSteps = nestedWorkflowSteps(entry);
    if (nestedSteps) {
      const nested = findForeachEntry(nestedSteps);
      if (nested) return nested;
    }
    if (entry.steps) {
      const nested = findForeachEntry(entry.steps);
      if (nested) return nested;
    }
  }
  return undefined;
}

function findLoopEntry(steps: any[]): any {
  for (const entry of steps ?? []) {
    if (entry.type === 'loop' && entry.loopType === 'dowhile') return entry;
    const nestedSteps = nestedWorkflowSteps(entry);
    if (nestedSteps) {
      const nested = findLoopEntry(nestedSteps);
      if (nested) return nested;
    }
    if (entry.steps) {
      const nested = findLoopEntry(entry.steps);
      if (nested) return nested;
    }
  }
  return undefined;
}

function findStepEntry(steps: any[], id: string): any {
  for (const entry of steps ?? []) {
    if (entry.type === 'mapping' && entry.id === id) {
      return {
        ...entry,
        step: {
          id: entry.id,
          execute: (params: any) =>
            entry.mapConfig({
              ...params,
              getInitData: params.getInitData ?? (() => params.inputData),
            }),
        },
      };
    }
    if (entry.type === 'step' && entry.step?.id === id) return entry;
    if (entry.type === 'step' && entry.step?.step?.id === id) return { ...entry, step: entry.step.step };
    const nestedSteps = nestedWorkflowSteps(entry);
    if (nestedSteps) {
      const nested = findStepEntry(nestedSteps, id);
      if (nested) return nested;
    }
    if (entry.steps) {
      const nested = findStepEntry(entry.steps, id);
      if (nested) return nested;
    }
  }
  return undefined;
}

describe('createInngestDurableAgenticWorkflow ownership IDs', () => {
  const inngest = new Inngest({ id: 'inngest-agentic-workflow-id-tests' });

  it('uses protocol-v4 shared IDs for direct factory callers', () => {
    const workflow = createInngestDurableAgenticWorkflow({ inngest }) as any;
    const functionIds = workflow.getFunctions().map((fn: any) => fn.id());

    expect(workflow.id).toBe(InngestDurableStepIds.AGENTIC_LOOP);
    expect(functionIds).toEqual(
      expect.arrayContaining([
        `workflow.${InngestDurableStepIds.AGENTIC_LOOP}`,
        `workflow.${InngestDurableStepIds.AGENTIC_EXECUTION}`,
      ]),
    );
  });

  it('derives deterministic collision-safe IDs from the public durable-agent ID', () => {
    const first = createInngestDurableAgenticWorkflowIds('owner-agent');
    const repeated = createInngestDurableAgenticWorkflowIds('owner-agent');
    const other = createInngestDurableAgenticWorkflowIds('other-agent');

    expect(first).toEqual(repeated);
    expect(first).not.toEqual(other);
    expect(INNGEST_DURABLE_AGENT_PROTOCOL_VERSION).toBe('v4');
    expect(first.AGENTIC_LOOP).toMatch(/^inngest:v4:durable-agentic-loop:[a-f0-9]{32}$/);
    expect(first.AGENTIC_EXECUTION).toMatch(/^inngest:v4:durable-agentic-execution:[a-f0-9]{32}$/);
    expect(() => createInngestDurableAgenticWorkflowIds('')).toThrow(/non-empty agent ID/);
  });

  it.each(['v2', 'v3'])('does not reuse the protocol-%s function identity', legacyVersion => {
    const agentId = 'policy-owner';
    const current = createInngestDurableAgenticWorkflowIds(agentId);
    const legacyOwnerHash = createHash('sha256')
      .update(`mastra:inngest:durable-agent:${legacyVersion}\0${agentId}`)
      .digest('hex')
      .slice(0, 32);

    // A worker from a prior protocol must never claim a hook-protected run —
    // it would ignore the onBeforeToolExecution-required marker and execute
    // gated calls without revalidation.
    expect(current.AGENTIC_LOOP).not.toBe(`inngest:${legacyVersion}:durable-agentic-loop:${legacyOwnerHash}`);
    expect(current.AGENTIC_EXECUTION).not.toBe(`inngest:${legacyVersion}:durable-agentic-execution:${legacyOwnerHash}`);
  });

  it('applies the owner namespace to both parent and nested function IDs', () => {
    const workflowIds = createInngestDurableAgenticWorkflowIds('nested-owner');
    const workflow = createInngestDurableAgenticWorkflow({ inngest, workflowIds }) as any;
    const functionIds = workflow.getFunctions().map((fn: any) => fn.id());

    expect(workflow.id).toBe(workflowIds.AGENTIC_LOOP);
    expect(functionIds).toEqual(
      expect.arrayContaining([`workflow.${workflowIds.AGENTIC_LOOP}`, `workflow.${workflowIds.AGENTIC_EXECUTION}`]),
    );
    expect(functionIds).toHaveLength(2);
  });
});

describe('createInngestDurableAgenticWorkflow response recovery boundary', () => {
  const inngest = new Inngest({ id: 'inngest-agentic-workflow-recovery-tests' });
  const workflow = createInngestDurableAgenticWorkflow({ inngest });
  const initEntry = findStepEntry((workflow as any).executionGraph.steps, 'init-iteration-state');

  it('rejects response-only recovery before the first durable iteration', async () => {
    await expect(initEntry.step.execute({ inputData: { options: { recoveryMaxSteps: 1 } } })).rejects.toThrow(
      'Inngest durable agents do not support response-only recovery; recoveryMaxSteps must be 0',
    );
  });

  it('accepts an explicit zero recovery budget', async () => {
    const state = await initEntry.step.execute({ inputData: { options: { recoveryMaxSteps: 0 } } });

    expect(state.options.recoveryMaxSteps).toBe(0);
    expect(state.iterationCount).toBe(0);
  });
});

describe('createInngestDurableAgenticWorkflow tool-call concurrency', () => {
  const inngest = new Inngest({ id: 'inngest-agentic-workflow-concurrency-tests' });
  const workflow = createInngestDurableAgenticWorkflow({ inngest });
  const foreachEntry = findForeachEntry((workflow as any).executionGraph.steps);

  const resolveWith = (state: unknown, inputData: unknown[] = [], requestContext?: RequestContext): number => {
    const resolver = foreachEntry.opts.concurrency;
    expect(typeof resolver).toBe('function');
    return resolver({ inputData, getInitData: () => state, requestContext });
  };

  it('uses a concurrency resolver on the tool-call foreach (not a static value)', () => {
    expect(foreachEntry).toBeDefined();
    expect(typeof foreachEntry.opts.concurrency).toBe('function');
  });

  it('resolves the configured toolCallConcurrency from the iteration state', () => {
    expect(
      resolveWith({
        options: { toolCallConcurrency: 5 },
        toolsMetadata: [{ id: 'plain', name: 'plain', inputSchema: { type: 'object' } }],
      }),
    ).toBe(5);
  });

  it('defaults to the standard tool-call concurrency when unset', () => {
    expect(resolveWith({ options: {}, toolsMetadata: [] })).toBe(DurableAgentDefaults.TOOL_CALL_CONCURRENCY);
    // Missing init data (e.g. unexpected replay shape) must not crash — it
    // falls back to defaults.
    expect(resolveWith(undefined)).toBe(DurableAgentDefaults.TOOL_CALL_CONCURRENCY);
  });

  it('forces sequential execution when requireToolApproval is set globally', () => {
    expect(
      resolveWith({
        options: { requireToolApproval: true, toolCallConcurrency: 10 },
        toolsMetadata: [],
      }),
    ).toBe(1);
  });

  it('forces sequential execution when a per-tool permission policy may ask', () => {
    expect(
      resolveWith({
        options: { permissionPolicyRequired: true, toolCallConcurrency: 10 },
        toolsMetadata: [],
      }),
    ).toBe(1);
  });

  it('uses configured concurrency for a stable live all-allow policy', () => {
    const requestContext = new RequestContext();
    requestContext.set(TOOL_PERMISSION_POLICY_KEY, () => 'allow');
    requestContext.set(TOOL_PERMISSION_POLICY_STABLE_KEY, true);

    expect(
      resolveWith(
        { options: { permissionPolicyRequired: true, toolCallConcurrency: 4 }, toolsMetadata: [] },
        [
          { toolCallId: 'call-a', toolName: 'read_a', args: {} },
          { toolCallId: 'call-b', toolName: 'read_b', args: {} },
        ],
        requestContext,
      ),
    ).toBe(4);
  });

  it('keeps mixed ask plus allow and throwing live policies sequential', () => {
    const requestContext = new RequestContext();
    requestContext.set(TOOL_PERMISSION_POLICY_STABLE_KEY, true);
    requestContext.set(TOOL_PERMISSION_POLICY_KEY, (toolName: string) => (toolName === 'write' ? 'ask' : 'allow'));
    const state = { options: { permissionPolicyRequired: true, toolCallConcurrency: 4 }, toolsMetadata: [] };
    const calls = [
      { toolCallId: 'call-read', toolName: 'read', args: {} },
      { toolCallId: 'call-write', toolName: 'write', args: {} },
    ];

    expect(resolveWith(state, calls, requestContext)).toBe(1);

    requestContext.set(TOOL_PERMISSION_POLICY_KEY, () => {
      throw new Error('policy unavailable');
    });
    expect(resolveWith(state, calls, requestContext)).toBe(1);
  });

  it('forces two legacy tool calls sequentially when only RequestContext carries the policy marker', () => {
    const requestContext = new RequestContext();
    requestContext.set(TOOL_PERMISSION_POLICY_REQUIRED_KEY, true);
    const resolver = foreachEntry.opts.concurrency;
    const toolCalls = [
      { toolCallId: 'call-a', toolName: 'write_file', args: { path: 'a.tex' } },
      { toolCallId: 'call-b', toolName: 'write_file', args: { path: 'b.tex' } },
    ];

    expect(
      resolver({
        inputData: toolCalls,
        getInitData: () => ({
          options: { permissionPolicyRequired: false, toolCallConcurrency: 10 },
          toolsMetadata: [],
        }),
        requestContext,
      }),
    ).toBe(1);
  });

  it('forces sequential execution from factory resolver configuration even if replay state loses its marker', () => {
    const resolverWorkflow = createInngestDurableAgenticWorkflow({
      inngest,
      resolveToolPermission: () => 'allow',
    });
    const resolverForeach = findForeachEntry((resolverWorkflow as any).executionGraph.steps);
    const resolver = resolverForeach.opts.concurrency;

    expect(
      resolver({
        inputData: [],
        getInitData: () => ({ options: { toolCallConcurrency: 10 }, toolsMetadata: [] }),
      }),
    ).toBe(1);
    expect(resolver({ inputData: [], getInitData: () => undefined })).toBe(1);
  });

  it('forces sequential execution when a tool requires approval', () => {
    expect(
      resolveWith({
        options: { toolCallConcurrency: 10 },
        toolsMetadata: [
          { id: 'plain', name: 'plain', inputSchema: { type: 'object' } },
          { id: 'gated', name: 'gated', inputSchema: { type: 'object' }, requireApproval: true },
        ],
      }),
    ).toBe(1);
  });

  it('forces sequential execution when a tool can suspend', () => {
    expect(
      resolveWith({
        options: { toolCallConcurrency: 10 },
        toolsMetadata: [
          { id: 'suspending', name: 'suspending', inputSchema: { type: 'object' }, hasSuspendSchema: true },
        ],
      }),
    ).toBe(1);
  });
});

describe('createInngestDurableAgenticWorkflow permission policy', () => {
  const inngest = new Inngest({ id: 'inngest-agentic-workflow-permission-tests' });
  const workflow = createInngestDurableAgenticWorkflow({ inngest }) as any;
  const toolCallStep = findForeachEntry(workflow.executionGraph.steps).step;

  it('fails closed before tool execution when a configured policy evaluator was lost', async () => {
    const runId = 'inngest-missing-permission-policy';
    const runtimeBindingId = 'inngest-missing-permission-policy-binding';
    const execute = vi.fn().mockResolvedValue({ unsafe: true });
    globalRunRegistry.set(runId, {
      runtimeBindingId,
      tools: { write_file: { id: 'write_file', execute } },
      model: {} as any,
    } as any);

    try {
      const result = await toolCallStep.execute({
        inputData: { toolCallId: 'call-write', toolName: 'write_file', args: { path: 'paper.tex' } },
        mastra: { getLogger: () => undefined },
        suspend: vi.fn(),
        resumeData: undefined,
        requestContext: new Map(),
        getInitData: () => ({
          runId,
          runtimeBindingId,
          agentId: 'inngest-permission-agent',
          options: { permissionPolicyRequired: true },
          toolsMetadata: [],
          messageListState: new MessageList().serialize(),
          state: {},
        }),
        [PUBSUB_SYMBOL]: { publish: vi.fn() },
      });

      expect(result).toMatchObject({ disposition: 'denied' });
      expect(execute).not.toHaveBeenCalled();
    } finally {
      globalRunRegistry.delete(runId);
    }
  });

  it('uses the worker resolver on both sides of an ask approval resume', async () => {
    const runId = 'inngest-worker-policy-ask';
    const runtimeBindingId = 'inngest-worker-policy-ask-binding';
    const execute = vi.fn().mockResolvedValue({ written: true });
    const resolveToolPermission = vi.fn().mockResolvedValue('ask');
    const resolverWorkflow = createInngestDurableAgenticWorkflow({ inngest, resolveToolPermission }) as any;
    const resolverToolCallStep = findForeachEntry(resolverWorkflow.executionGraph.steps).step;
    const requestContext = new RequestContext();
    requestContext.set('sessionId', 'session-1');
    globalRunRegistry.set(runId, {
      runtimeBindingId,
      tools: { write_file: { id: 'write_file', execute } },
      model: {} as any,
    } as any);

    const initData = () => ({
      runId,
      runtimeBindingId,
      agentId: 'inngest-permission-agent',
      options: { permissionPolicyRequired: true },
      toolsMetadata: [],
      messageListState: new MessageList().serialize(),
      state: {},
    });
    const inputData = { toolCallId: 'call-write', toolName: 'write_file', args: { path: 'paper.tex' } };
    const pubsub = { publish: vi.fn() };
    const suspend = vi.fn().mockReturnValue({ status: 'suspended' });

    try {
      const first = await resolverToolCallStep.execute({
        inputData,
        mastra: { getLogger: () => undefined },
        suspend,
        resumeData: undefined,
        requestContext,
        getInitData: initData,
        [PUBSUB_SYMBOL]: pubsub,
      });
      expect(first).toEqual({ status: 'suspended' });
      expect(execute).not.toHaveBeenCalled();

      const suspendData = suspend.mock.calls[0]?.[0];
      const resumed = await resolverToolCallStep.execute({
        inputData,
        mastra: { getLogger: () => undefined },
        suspend: vi.fn(),
        resumeData: { approved: true },
        suspendData,
        requestContext,
        getInitData: initData,
        [PUBSUB_SYMBOL]: pubsub,
      });

      expect(resumed.result).toEqual({ written: true });
      expect(execute).toHaveBeenCalledOnce();
      expect(resolveToolPermission).toHaveBeenCalledTimes(2);
      expect(resolveToolPermission.mock.calls.map(([input]) => input.isResume)).toEqual([false, true]);
      expect(resolveToolPermission).toHaveBeenLastCalledWith(
        expect.objectContaining({
          runId,
          agentId: 'inngest-permission-agent',
          toolCallId: 'call-write',
          toolName: 'write_file',
          args: { path: 'paper.tex' },
          requestContext,
          isResume: true,
        }),
      );
    } finally {
      globalRunRegistry.delete(runId);
    }
  });
});

describe('createInngestDurableAgenticWorkflow terminal tool result', () => {
  const inngest = new Inngest({ id: 'inngest-agentic-workflow-terminal-result-tests' });
  const workflow = createInngestDurableAgenticWorkflow({ inngest }) as any;
  const loopEntry = findLoopEntry(workflow.executionGraph.steps);
  const finalOutputEntry = findStepEntry(workflow.executionGraph.steps, 'map-final-output');
  const controlCleanupEntry = findStepEntry(workflow.executionGraph.steps, 'clear-agent-control-topic');

  async function executeFinalWithBoundRuntime(params: any) {
    const runId = params.inputData.runId as string;
    const previousEntry = globalRunRegistry.get(runId);
    const suppliedInitData = params.getInitData?.() ?? params.inputData;
    const runtimeBindingId = suppliedInitData.runtimeBindingId ?? `${runId}-binding`;
    globalRunRegistry.set(runId, {
      ...previousEntry,
      runtimeBindingId,
      isPlaceholder: true,
    } as any);
    const suppliedPubsub = params[PUBSUB_SYMBOL];
    const pubsub = suppliedPubsub
      ? {
          subscribeWithReplay: vi.fn().mockResolvedValue(undefined),
          unsubscribe: vi.fn().mockResolvedValue(undefined),
          ...suppliedPubsub,
        }
      : undefined;

    try {
      return await finalOutputEntry.step.execute({
        ...params,
        getInitData: () => ({ ...suppliedInitData, runId, runtimeBindingId }),
        ...(pubsub ? { [PUBSUB_SYMBOL]: pubsub } : {}),
      });
    } finally {
      if (previousEntry) globalRunRegistry.set(runId, previousEntry);
      else globalRunRegistry.delete(runId);
    }
  }

  it('runs the signal-precedence step before committing terminal delivery', () => {
    expect(
      findStepEntry(workflow.executionGraph.steps, `${DurableStepIds.AGENTIC_EXECUTION}-signal-drain`),
    ).toBeDefined();
  });

  it('rejects a stale loop predicate before reading a newer reused-run binding', async () => {
    const runId = 'run-terminal-loop-rebound';
    globalRunRegistry.set(runId, {
      runtimeBindingId: 'new-binding',
      tools: {},
      model: {} as any,
      abortSignal: AbortSignal.abort('new-run-abort'),
    } as any);

    try {
      await expect(
        loopEntry.condition({
          inputData: { runId },
          getInitData: () => ({ runId, runtimeBindingId: 'stale-binding' }),
        }),
      ).rejects.toThrow(/no longer matches its registered runtime dependencies/);
    } finally {
      globalRunRegistry.delete(runId);
    }
  });

  it('revalidates the binding after final-map listener setup', async () => {
    const runId = 'run-terminal-map-rebound';
    const oldBinding = 'old-binding';
    let releaseSubscription!: () => void;
    let markSubscriptionStarted!: () => void;
    const subscriptionStarted = new Promise<void>(resolve => {
      markSubscriptionStarted = resolve;
    });
    const subscriptionReleased = new Promise<void>(resolve => {
      releaseSubscription = resolve;
    });
    const pubsub = {
      subscribeWithReplay: vi.fn(async () => {
        markSubscriptionStarted();
        await subscriptionReleased;
      }),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
    };
    globalRunRegistry.set(runId, {
      runtimeBindingId: oldBinding,
      tools: {},
      model: {} as any,
    } as any);
    const execution = finalOutputEntry.step.execute({
      inputData: { runId },
      getInitData: () => ({ runId, runtimeBindingId: oldBinding }),
      mastra: undefined,
      [PUBSUB_SYMBOL]: pubsub,
    });
    await subscriptionStarted;
    globalRunRegistry.set(runId, {
      runtimeBindingId: 'new-binding',
      tools: {},
      model: {} as any,
    } as any);
    releaseSubscription();

    try {
      await expect(execution).rejects.toThrow(/no longer matches its registered runtime dependencies/);
    } finally {
      globalRunRegistry.delete(runId);
    }
  });

  it('retries the final map when retained abort replay subscription fails', async () => {
    const runId = 'run-terminal-replay-subscription-failure';
    const runtimeBindingId = 'run-terminal-replay-subscription-failure-binding';
    const replayError = new Error('transient replay subscription failure');
    const pubsub = {
      publish: vi.fn().mockResolvedValue(undefined),
      subscribeWithReplay: vi.fn().mockRejectedValue(replayError),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
      clearTopicOrThrow: vi.fn().mockResolvedValue(undefined),
    };
    globalRunRegistry.set(runId, {
      runtimeBindingId,
      tools: {},
      model: {} as any,
    } as any);

    try {
      await expect(
        finalOutputEntry.step.execute({
          inputData: { runId },
          getInitData: () => ({ runId, runtimeBindingId }),
          mastra: undefined,
          [PUBSUB_SYMBOL]: pubsub,
        }),
      ).rejects.toBe(replayError);
      expect(pubsub.publish).not.toHaveBeenCalled();
      expect(pubsub.clearTopicOrThrow).not.toHaveBeenCalled();
    } finally {
      globalRunRegistry.delete(runId);
    }
  });

  it('emits the terminal result before step finish and stops without another iteration', async () => {
    const published: any[] = [];
    const pubsub = {
      async publish(_topic: string, event: unknown) {
        published.push(event);
      },
      subscribeWithReplay: vi.fn().mockResolvedValue(undefined),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
      clearTopicOrThrow: vi.fn().mockResolvedValue(undefined),
    };
    globalRunRegistry.set('run-terminal', {
      runtimeBindingId: 'run-terminal-binding',
      tools: {},
      model: {} as any,
    } as any);
    const state = {
      runId: 'run-terminal',
      runtimeBindingId: 'run-terminal-binding',
      accumulatedSteps: [{}],
      accumulatedUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      messageListState: new MessageList().serialize(),
      messageId: 'message-1',
      state: {},
      lastStepResult: { isContinued: true },
      terminalToolResult: {
        status: 'success',
        items: [
          {
            toolName: 'answer',
            toolCallId: 'call-1',
            status: 'success',
            value: { answer: 'done' },
          },
        ],
      },
      deferredStepFinishChunk: { type: 'step-finish', payload: { reason: 'tool-calls' } },
    };

    const getInitData = () => state;
    const shouldContinue = await loopEntry.condition({
      inputData: state,
      getInitData,
      [PUBSUB_SYMBOL]: pubsub,
    });

    expect(shouldContinue).toBe(false);
    expect(state.lastStepResult.isContinued).toBe(false);
    expect(state.deferredStepFinishChunk).toBeDefined();
    expect(published).toEqual([]);

    await finalOutputEntry.step.execute({
      inputData: state,
      getInitData,
      mastra: undefined,
      [PUBSUB_SYMBOL]: pubsub,
    });

    expect(state.deferredStepFinishChunk).toBeUndefined();
    expect(published).toHaveLength(1);
    expect(published[0].type).toBe('finish');
    expect(published[0].data.terminalToolResult.id).toBe(createTerminalToolResultPartId('run-terminal', 1));
    expect(published[0].data.terminalStepFinishChunk.type).toBe('step-finish');
    expect(pubsub.subscribeWithReplay).toHaveBeenCalledWith(
      AGENT_CONTROL_TOPIC('run-terminal', 'run-terminal-binding'),
      expect.any(Function),
    );
    // The final map is not durably acknowledged yet, so it must leave the
    // replayed abort intact. The following memoized operation owns cleanup.
    expect(pubsub.clearTopicOrThrow).not.toHaveBeenCalled();

    await controlCleanupEntry.step.execute({
      inputData: { done: true },
      getInitData: () => ({ runId: 'run-terminal', runtimeBindingId: 'run-terminal-binding' }),
      [PUBSUB_SYMBOL]: pubsub,
    });

    expect(pubsub.clearTopicOrThrow).toHaveBeenCalledWith(AGENT_CONTROL_TOPIC('run-terminal', 'run-terminal-binding'));
    globalRunRegistry.delete('run-terminal');
  });

  it('treats stale cleanup as a no-op when a newer run reused the ID', async () => {
    const runId = 'run-terminal-cleanup-rebound';
    const pubsub = { clearTopicOrThrow: vi.fn().mockResolvedValue(undefined) };
    globalRunRegistry.set(runId, {
      runtimeBindingId: 'new-binding',
      tools: {},
      model: {} as any,
    } as any);

    try {
      const input = { done: true };
      await expect(
        controlCleanupEntry.step.execute({
          inputData: input,
          getInitData: () => ({ runId, runtimeBindingId: 'stale-binding' }),
          [PUBSUB_SYMBOL]: pubsub,
        }),
      ).resolves.toBe(input);
      expect(pubsub.clearTopicOrThrow).not.toHaveBeenCalled();
    } finally {
      globalRunRegistry.delete(runId);
    }
  });

  it('rejects failed control cleanup so the durable operation can retry', async () => {
    const runId = 'run-terminal-cleanup-retry';
    const runtimeBindingId = 'cleanup-retry-binding';
    const clearTopicOrThrow = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient cleanup failure'))
      .mockResolvedValueOnce(undefined);
    const pubsub = { clearTopicOrThrow };
    globalRunRegistry.set(runId, {
      runtimeBindingId,
      tools: {},
      model: {} as any,
    } as any);
    const execute = () =>
      controlCleanupEntry.step.execute({
        inputData: { done: true },
        getInitData: () => ({ runId, runtimeBindingId }),
        [PUBSUB_SYMBOL]: pubsub,
      });

    try {
      await expect(execute()).rejects.toThrow('transient cleanup failure');
      await expect(execute()).resolves.toEqual({ done: true });
      expect(clearTopicOrThrow).toHaveBeenCalledTimes(2);
    } finally {
      globalRunRegistry.delete(runId);
    }
  });

  it('rehydrates backing memory and persists the terminal marker during finalization', async () => {
    const runId = 'run-terminal-memory-restart';
    const threadId = 'thread-terminal-memory-restart';
    const resourceId = 'resource-terminal-memory-restart';
    const saveMessages = vi.fn().mockResolvedValue(undefined);
    const processOutputResult = vi.fn(async ({ messageList }) => messageList);
    const outputProcessor = {
      id: 'restart-safe-output-processor',
      terminalToolResultPolicy: 'pass-through',
      processOutputResult,
    };
    const memory = {
      saveMessages,
      createThread: vi.fn().mockResolvedValue(undefined),
    };
    const logger = { debug: vi.fn(), error: vi.fn(), warn: vi.fn() };
    const agent = {
      getToolsForExecution: vi.fn().mockResolvedValue({}),
      getModel: vi.fn().mockResolvedValue({ provider: 'test', modelId: 'test-model', specificationVersion: 'v2' }),
      getModelList: vi.fn().mockResolvedValue(undefined),
      getMemory: vi.fn().mockResolvedValue(memory),
      getWorkspace: vi.fn().mockResolvedValue(undefined),
      listInputProcessors: vi.fn().mockResolvedValue([]),
      __listLLMRequestProcessors: vi.fn().mockResolvedValue([]),
      listOutputProcessors: vi.fn().mockResolvedValue([outputProcessor]),
      listErrorProcessors: vi.fn().mockResolvedValue([]),
    };
    const mastra = {
      getAgentById: vi.fn().mockReturnValue(agent),
      getLogger: () => logger,
    };
    const initialMessageList = new MessageList({ threadId, resourceId });
    const state = {
      runId,
      agentId: 'terminal-memory-agent',
      accumulatedSteps: [{}],
      accumulatedUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      messageListState: initialMessageList.serialize(),
      messageId: 'message-terminal-memory',
      state: {
        memoryConfigured: true,
        threadId,
        resourceId,
        threadExists: false,
        observationalMemory: false,
        memoryConfig: {},
      },
      lastStepResult: { reason: 'tool-calls', warnings: [], isContinued: false },
      terminalToolResult: {
        status: 'success',
        items: [
          {
            toolName: 'answer',
            toolCallId: 'call-memory',
            status: 'success',
            value: { answer: 'persisted after restart' },
          },
        ],
      },
    };
    const initData = {
      __workflowKind: 'durable-agent',
      runId,
      agentId: state.agentId,
      messageListState: state.messageListState,
      toolsMetadata: [],
      modelConfig: { provider: 'test', modelId: 'test-model', specificationVersion: 'v2' },
      options: {},
      state: state.state,
      messageId: state.messageId,
    };

    await finalOutputEntry.step.execute({
      inputData: state,
      mastra,
      getInitData: () => initData,
    });

    expect(agent.getMemory).toHaveBeenCalledOnce();
    expect(memory.createThread).toHaveBeenCalledOnce();
    expect(memory.createThread).toHaveBeenCalledWith(expect.objectContaining({ threadId, resourceId }));
    expect(processOutputResult).toHaveBeenCalledOnce();
    expect(processOutputResult.mock.calls[0]?.[0]?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.objectContaining({
            parts: expect.arrayContaining([
              expect.objectContaining({
                type: 'data-terminal-tool-result',
                id: createTerminalToolResultPartId(runId, 1),
              }),
            ]),
          }),
        }),
      ]),
    );
    expect(saveMessages).toHaveBeenCalledOnce();
    const persisted = saveMessages.mock.calls[0]?.[0]?.messages as Array<{ content?: { parts?: unknown[] } }>;
    expect(persisted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.objectContaining({
            parts: expect.arrayContaining([
              expect.objectContaining({
                type: 'data-terminal-tool-result',
                id: createTerminalToolResultPartId(runId, 1),
              }),
            ]),
          }),
        }),
      ]),
    );
  });

  it.each([
    ['existing', true],
    ['new', false],
  ])('does not publish when configured memory cannot be rehydrated for an %s thread', async (_label, exists) => {
    const published: unknown[] = [];
    const state = {
      runId: `run-terminal-missing-memory-${_label}`,
      agentId: 'missing-memory-agent',
      accumulatedSteps: [{}],
      accumulatedUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      messageListState: new MessageList().serialize(),
      messageId: `message-terminal-missing-memory-${_label}`,
      state: {
        memoryConfigured: true,
        threadId: `thread-terminal-missing-memory-${_label}`,
        resourceId: 'resource-terminal-missing-memory',
        threadExists: exists,
        observationalMemory: false,
        memoryConfig: {},
      },
      lastStepResult: { reason: 'tool-calls', warnings: [], isContinued: false },
      terminalToolResult: {
        status: 'success',
        items: [
          {
            toolName: 'answer',
            toolCallId: 'call-missing-memory',
            status: 'success',
            value: { answer: 'must not publish' },
          },
        ],
      },
    };

    await expect(
      executeFinalWithBoundRuntime({
        inputData: state,
        mastra: undefined,
        [PUBSUB_SYMBOL]: {
          async publish(_topic: string, event: unknown) {
            published.push(event);
          },
        },
      }),
    ).rejects.toThrow('configured memory could not be resolved');

    expect(published).toEqual([]);
  });

  it('does not publish when a rehydrated terminal output processor fails', async () => {
    const published: unknown[] = [];
    const processOutputResult = vi.fn().mockRejectedValue(new Error('processor persistence failed'));
    const memory = { saveMessages: vi.fn(), createThread: vi.fn() };
    const agent = {
      getToolsForExecution: vi.fn().mockResolvedValue({}),
      getModel: vi.fn().mockResolvedValue({ provider: 'test', modelId: 'test-model', specificationVersion: 'v2' }),
      getModelList: vi.fn().mockResolvedValue(undefined),
      getMemory: vi.fn().mockResolvedValue(memory),
      getWorkspace: vi.fn().mockResolvedValue(undefined),
      listInputProcessors: vi.fn().mockResolvedValue([]),
      __listLLMRequestProcessors: vi.fn().mockResolvedValue([]),
      listOutputProcessors: vi
        .fn()
        .mockResolvedValue([{ id: 'failing-output', terminalToolResultPolicy: 'pass-through', processOutputResult }]),
      listErrorProcessors: vi.fn().mockResolvedValue([]),
    };
    const mastra = { getAgentById: vi.fn().mockReturnValue(agent), getLogger: () => ({ warn: vi.fn() }) };
    const state = {
      runId: 'run-terminal-inngest-processor-failure',
      agentId: 'terminal-processor-agent',
      accumulatedSteps: [{}],
      accumulatedUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      messageListState: new MessageList().serialize(),
      messageId: 'message-terminal-processor-failure',
      state: {
        memoryConfigured: true,
        threadId: 'thread-terminal-processor-failure',
        resourceId: 'resource-terminal-processor-failure',
        threadExists: true,
        observationalMemory: false,
        memoryConfig: {},
      },
      lastStepResult: { reason: 'tool-calls', warnings: [], isContinued: false },
      terminalToolResult: {
        status: 'success',
        items: [
          {
            toolName: 'answer',
            toolCallId: 'call-processor-failure',
            status: 'success',
            value: { answer: 'must not publish' },
          },
        ],
      },
    };

    await expect(
      executeFinalWithBoundRuntime({
        inputData: state,
        mastra,
        getInitData: () => ({
          __workflowKind: 'durable-agent',
          runId: state.runId,
          agentId: state.agentId,
          messageListState: state.messageListState,
          toolsMetadata: [],
          modelConfig: { provider: 'test', modelId: 'test-model', specificationVersion: 'v2' },
          options: {},
          state: state.state,
          messageId: state.messageId,
        }),
        [PUBSUB_SYMBOL]: {
          async publish(_topic: string, event: unknown) {
            published.push(event);
          },
        },
      }),
    ).rejects.toThrow('processor persistence failed');

    expect(processOutputResult).toHaveBeenCalledOnce();
    expect(memory.saveMessages).not.toHaveBeenCalled();
    expect(published).toEqual([]);
  });

  it.each(['delete', 'mutate', 'duplicate'] as const)(
    'does not publish when a rehydrated final processor %ss the terminal marker',
    async mode => {
      const published: unknown[] = [];
      const processOutputResult = vi.fn(({ messages }: { messages: any[] }) =>
        messages.map(message => ({
          ...message,
          content: {
            ...message.content,
            parts: message.content.parts.flatMap((part: any) => {
              if (part.type !== 'data-terminal-tool-result') return [part];
              if (mode === 'delete') return [];
              if (mode === 'duplicate') return [part, structuredClone(part)];
              return [
                {
                  ...part,
                  data: {
                    ...part.data,
                    items: part.data.items.map((item: any) => ({ ...item, value: { answer: 'changed' } })),
                  },
                },
              ];
            }),
          },
        })),
      );
      const outputProcessor = {
        id: `invalidating-terminal-owner-${mode}`,
        terminalToolResultPolicy: 'pass-through',
        terminalToolResultPersistence: 'owner',
        processOutputResult,
      };
      const agent = {
        getToolsForExecution: vi.fn().mockResolvedValue({}),
        getModel: vi.fn().mockResolvedValue({ provider: 'test', modelId: 'test-model', specificationVersion: 'v2' }),
        getModelList: vi.fn().mockResolvedValue(undefined),
        getMemory: vi.fn().mockResolvedValue(undefined),
        getWorkspace: vi.fn().mockResolvedValue(undefined),
        listInputProcessors: vi.fn().mockResolvedValue([]),
        __listLLMRequestProcessors: vi.fn().mockResolvedValue([]),
        listOutputProcessors: vi.fn().mockResolvedValue([outputProcessor]),
        listErrorProcessors: vi.fn().mockResolvedValue([]),
      };
      const mastra = {
        getAgentById: vi.fn().mockReturnValue(agent),
        getLogger: () => ({ debug: vi.fn(), error: vi.fn(), warn: vi.fn() }),
      };
      const state = {
        runId: `run-terminal-inngest-${mode}`,
        agentId: 'terminal-integrity-agent',
        accumulatedSteps: [{}],
        accumulatedUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        messageListState: new MessageList().serialize(),
        messageId: `message-terminal-inngest-${mode}`,
        state: {
          memoryConfigured: false,
          threadId: `thread-terminal-inngest-${mode}`,
          resourceId: 'resource-terminal-inngest-integrity',
          threadExists: false,
          observationalMemory: false,
          memoryConfig: {},
        },
        lastStepResult: { reason: 'tool-calls', warnings: [], isContinued: false },
        terminalToolResult: {
          status: 'success',
          items: [
            {
              toolName: 'answer',
              toolCallId: `call-integrity-${mode}`,
              status: 'success',
              value: { answer: 'must remain exact' },
            },
          ],
        },
      };

      await expect(
        executeFinalWithBoundRuntime({
          inputData: state,
          mastra,
          getInitData: () => ({
            __workflowKind: 'durable-agent',
            runId: state.runId,
            agentId: state.agentId,
            messageListState: state.messageListState,
            toolsMetadata: [],
            modelConfig: { provider: 'test', modelId: 'test-model', specificationVersion: 'v2' },
            options: {},
            state: state.state,
            messageId: state.messageId,
          }),
          [PUBSUB_SYMBOL]: {
            async publish(_topic: string, event: unknown) {
              published.push(event);
            },
          },
        }),
      ).rejects.toThrow(/retain exactly one|changed the terminal tool result/);

      expect(processOutputResult).toHaveBeenCalledOnce();
      expect(published).toEqual([]);
    },
  );

  it('retries a failed new-thread memory write and publishes exactly once after persistence', async () => {
    const published: any[] = [];
    const persisted: any[] = [];
    const memory = {
      saveMessages: vi
        .fn()
        .mockRejectedValueOnce(new Error('memory flush failed'))
        .mockImplementation(async ({ messages }: { messages: any[] }) => {
          persisted.push(...messages);
        }),
      createThread: vi.fn().mockResolvedValue(undefined),
    };
    const agent = {
      getToolsForExecution: vi.fn().mockResolvedValue({}),
      getModel: vi.fn().mockResolvedValue({ provider: 'test', modelId: 'test-model', specificationVersion: 'v2' }),
      getModelList: vi.fn().mockResolvedValue(undefined),
      getMemory: vi.fn().mockResolvedValue(memory),
      getWorkspace: vi.fn().mockResolvedValue(undefined),
      listInputProcessors: vi.fn().mockResolvedValue([]),
      __listLLMRequestProcessors: vi.fn().mockResolvedValue([]),
      listOutputProcessors: vi.fn().mockResolvedValue([]),
      listErrorProcessors: vi.fn().mockResolvedValue([]),
    };
    const mastra = {
      getAgentById: vi.fn().mockReturnValue(agent),
      getLogger: () => ({ warn: vi.fn(), error: vi.fn() }),
    };
    const state = {
      runId: 'run-terminal-inngest-memory-failure',
      agentId: 'terminal-memory-failure-agent',
      accumulatedSteps: [{}],
      accumulatedUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      messageListState: new MessageList().serialize(),
      messageId: 'message-terminal-memory-failure',
      state: {
        memoryConfigured: true,
        threadId: 'thread-terminal-memory-failure',
        resourceId: 'resource-terminal-memory-failure',
        threadExists: false,
        observationalMemory: false,
        memoryConfig: {},
      },
      lastStepResult: { reason: 'tool-calls', warnings: [], isContinued: false },
      terminalToolResult: {
        status: 'success',
        items: [
          {
            toolName: 'answer',
            toolCallId: 'call-memory-failure',
            status: 'success',
            value: { answer: 'must not publish' },
          },
        ],
      },
    };

    const params = {
      inputData: state,
      mastra,
      getInitData: () => ({
        __workflowKind: 'durable-agent',
        runId: state.runId,
        agentId: state.agentId,
        messageListState: state.messageListState,
        toolsMetadata: [],
        modelConfig: { provider: 'test', modelId: 'test-model', specificationVersion: 'v2' },
        options: {},
        state: state.state,
        messageId: state.messageId,
      }),
      [PUBSUB_SYMBOL]: {
        async publish(_topic: string, event: unknown) {
          published.push(event);
        },
      },
    };

    await expect(executeFinalWithBoundRuntime(params)).rejects.toThrow('memory flush failed');

    expect(memory.createThread).toHaveBeenCalledOnce();
    expect(memory.saveMessages).toHaveBeenCalledOnce();
    expect(published).toEqual([]);

    await executeFinalWithBoundRuntime(params);

    // The failed durable attempt may repeat the idempotent thread upsert; the
    // message write and finish publication remain the transactional boundary.
    expect(memory.createThread).toHaveBeenCalledTimes(2);
    expect(memory.saveMessages).toHaveBeenCalledTimes(2);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.content?.parts?.filter((part: any) => part.type === 'data-terminal-tool-result')).toHaveLength(
      1,
    );
    expect(published.filter(event => event.type === 'finish' && event.data?.terminalToolResult)).toHaveLength(1);
  });

  it.each([
    ['empty items', { status: 'success', items: [] }],
    [
      'oversized value',
      {
        status: 'success',
        items: [
          {
            toolName: 'answer',
            toolCallId: 'call-oversized',
            status: 'success',
            value: { text: 'x'.repeat(64 * 1024) },
          },
        ],
      },
    ],
  ])('rejects a replayed %s terminal payload before memory or publication', async (_label, terminal) => {
    const published: unknown[] = [];
    const state = {
      runId: `run-invalid-terminal-${_label}`,
      accumulatedSteps: [{}],
      accumulatedUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      messageListState: new MessageList().serialize(),
      messageId: 'invalid-terminal-message',
      state: {},
      lastStepResult: { reason: 'tool-calls', warnings: [], isContinued: false },
      terminalToolResult: terminal,
    };

    await expect(
      executeFinalWithBoundRuntime({
        inputData: state,
        mastra: undefined,
        [PUBSUB_SYMBOL]: {
          async publish(_topic: string, event: unknown) {
            published.push(event);
          },
        },
      }),
    ).rejects.toThrow(/Terminal tool result|byte limit/);
    expect(published).toEqual([]);
  });

  it('lets an abort landing before the final map override a terminal candidate', async () => {
    const runId = 'run-terminal-abort-window';
    const abortController = new AbortController();
    abortController.abort('cancel terminal delivery');
    globalRunRegistry.set(runId, { isPlaceholder: true, abortSignal: abortController.signal } as any);
    const published: any[] = [];
    const state = {
      runId,
      accumulatedSteps: [{}],
      accumulatedUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      messageListState: new MessageList().serialize(),
      messageId: 'message-terminal-abort-window',
      state: {},
      lastStepResult: { reason: 'tool-calls', warnings: [], isContinued: false },
      terminalToolResult: {
        status: 'success',
        items: [
          {
            toolName: 'answer',
            toolCallId: 'call-abort-window',
            status: 'success',
            value: { answer: 'must not publish' },
          },
        ],
      },
      deferredStepFinishChunk: { type: 'step-finish', payload: { reason: 'tool-calls' } },
    };

    try {
      await executeFinalWithBoundRuntime({
        inputData: state,
        mastra: undefined,
        [PUBSUB_SYMBOL]: {
          async publish(_topic: string, event: unknown) {
            published.push(event);
          },
        },
      });
    } finally {
      globalRunRegistry.delete(runId);
    }

    expect(state.terminalToolResult).toBeUndefined();
    expect(state.deferredStepFinishChunk).toBeUndefined();
    expect(state.lastStepResult).toMatchObject({ reason: 'abort', isContinued: false });
    expect(published.filter(event => event.data?.type === 'data-terminal-tool-result')).toHaveLength(0);
    expect(published).toEqual([expect.objectContaining({ type: 'finish' })]);
  });
});

/**
 * Regression coverage for #19842: durable tool execution on the Inngest engine
 * must run with a tracing context.
 *
 * 1. `extract-tool-calls` forwards the LLM step's exported MODEL_STEP span
 *    (`stepSpanData`) onto every tool-call input, so `createDurableToolCallStep`
 *    can rebuild it into the tool's `tracingContext` (live TOOL_CALL span +
 *    execution-time children such as workspace_action spans).
 * 2. `collect-tool-results` no longer creates retroactive TOOL_CALL spans (they
 *    would duplicate the live ones) — it only bundles results for the shared
 *    llmMappingStep, which ends the step span and emits tool-result chunks.
 */
describe('createInngestDurableAgenticWorkflow tool-call tracing (#19842)', () => {
  const inngest = new Inngest({ id: 'inngest-agentic-workflow-tracing-tests' });
  const workflow = createInngestDurableAgenticWorkflow({ inngest });
  const steps = (workflow as any).executionGraph.steps;

  const findMapping = (id: string) => findEntry(steps, entry => entry.type === 'mapping' && entry.id === id);

  it('extract-tool-calls forwards stepSpanData onto every tool-call input', async () => {
    const entry = findMapping('extract-tool-calls');
    expect(entry).toBeDefined();
    expect(typeof entry.mapConfig).toBe('function');

    const stepSpanData = { spanId: 'step-span-1', traceId: 'trace-1' };
    const result = await entry.mapConfig({
      getInitData: () => ({ iterationCount: 2 }),
      inputData: {
        toolCalls: [
          { toolCallId: 'call-1', toolName: 'writeFile', args: { path: 'a.txt' } },
          { toolCallId: 'call-2', toolName: 'readFile', args: { path: 'b.txt' } },
        ],
        stepSpanData,
      },
    });

    expect(result).toHaveLength(2);
    for (const toolCall of result) {
      expect(toolCall.stepSpanData).toEqual(stepSpanData);
      expect(toolCall.iterationCount).toBe(2);
    }
    expect(result[0]).toMatchObject({ toolCallId: 'call-1', toolName: 'writeFile' });
  });

  it('collect-tool-results does not create retroactive spans and bundles results for mapping', async () => {
    const entry = findMapping('collect-tool-results');
    expect(entry).toBeDefined();
    expect(typeof entry.mapConfig).toBe('function');

    const rebuildSpan = vi.fn();
    const getSelectedInstance = vi.fn(() => ({ rebuildSpan }));
    const llmOutput = {
      toolCalls: [{ toolCallId: 'call-1', toolName: 'writeFile', args: {} }],
      stepSpanData: { spanId: 'step-span-1' },
      state: { s: 1 },
    };
    const toolResults = [{ toolCallId: 'call-1', toolName: 'writeFile', result: 'ok' }];

    const result = await entry.mapConfig({
      inputData: toolResults,
      getStepResult: () => llmOutput,
      getInitData: () => ({
        runId: 'run-1',
        agentId: 'agent-1',
        messageId: 'msg-1',
        agentSpanData: { spanId: 'agent-span-1' },
        state: { s: 0 },
      }),
      mastra: { observability: { getSelectedInstance } },
    });

    // No retroactive span creation — the live TOOL_CALL span is created by the
    // tool-call step, and llmMappingStep owns step-span end + tool-result chunks.
    expect(getSelectedInstance).not.toHaveBeenCalled();
    expect(rebuildSpan).not.toHaveBeenCalled();

    expect(result).toEqual({
      llmOutput,
      toolResults,
      runId: 'run-1',
      agentId: 'agent-1',
      messageId: 'msg-1',
      state: { s: 1 },
    });
  });
});

/**
 * `map-final-output` runs the finish side effects through `engine.step.run`. These tests
 * only care about how the spans are ended, so the fake engine returns the step's result
 * without invoking the callback. Mocking the module instead would leak across files,
 * because this package runs vitest with `--no-isolate`.
 */
const skipFinishSideEffects = async () => ({ messageListState: undefined, outputText: undefined });

describe('createInngestDurableAgenticWorkflow final span ends', () => {
  it('ends the model span with usage on attributes and the agent span with text only', async () => {
    const inngest = new Inngest({ id: 'inngest-agentic-workflow-final-span-tests' });
    const workflow = createInngestDurableAgenticWorkflow({ inngest });
    const entry = findEntry(
      (workflow as any).executionGraph.steps,
      entry => entry.type === 'mapping' && entry.id === 'map-final-output',
    );
    expect(entry).toBeDefined();

    const ended: AnyExportedSpan[] = [];
    const observability = new Observability({
      configs: {
        default: {
          serviceName: 'inngest-final-span-test',
          exporters: [
            {
              name: 'capture',
              async exportTracingEvent(event: TracingEvent) {
                if (event.type === TracingEventType.SPAN_ENDED) ended.push(event.exportedSpan);
              },
              async shutdown() {},
            } satisfies ObservabilityExporter,
          ],
        },
      },
    });
    const instance = observability.getSelectedInstance({})!;
    expect(instance).toBeDefined();

    // Real spans, exported the way InngestAgent.stream() hands them to the workflow.
    const agentSpan = instance.startSpan({ type: SpanType.AGENT_RUN, name: "agent run: 'a'" });
    const modelSpan = agentSpan.createChildSpan({ type: SpanType.MODEL_GENERATION, name: "llm: 'm'" });
    const usage = { inputTokens: 3, outputTokens: 5, totalTokens: 8 };
    const accumulatedSteps = [{ text: 'final answer' }];

    await entry.mapConfig({
      inputData: {
        runId: 'run-1',
        accumulatedSteps,
        accumulatedUsage: usage,
        lastStepResult: { reason: 'stop', isContinued: false, warnings: [] },
        modelSpanData: modelSpan.exportSpan(),
        agentSpanData: agentSpan.exportSpan(),
        state: {},
        messageListState: new MessageList().serialize(),
      },
      getInitData: () => ({
        runId: 'run-1',
        agentId: 'agent-1',
        state: {},
        modelConfig: { provider: 'test', modelId: 'test-model' },
      }),
      engine: { step: { run: skipFinishSideEffects } },
      mastra: { observability, getLogger: () => undefined },
    });

    const endedModel = ended.find(span => span.type === SpanType.MODEL_GENERATION);
    const endedAgent = ended.find(span => span.type === SpanType.AGENT_RUN);
    expect(endedModel).toBeDefined();
    expect(endedAgent).toBeDefined();

    // Usage belongs on the attributes, normalized to UsageStats the way every other
    // model span records it, rather than raw in the output.
    expect(endedModel!.output).toEqual({ text: 'final answer' });
    expect(endedModel!.attributes).toMatchObject({
      finishReason: 'stop',
      usage: { inputTokens: 3, outputTokens: 5, inputDetails: { text: 3 }, outputDetails: { text: 5 } },
    });
    expect(endedModel!.output).not.toHaveProperty('usage');

    // The agent span records the text only; usage and steps stay on the workflow result.
    expect(endedAgent!.output).toEqual({ text: 'final answer' });
    expect(endedAgent!.output).not.toHaveProperty('usage');
    expect(endedAgent!.output).not.toHaveProperty('steps');
  });

  it('keeps usage and steps on the workflow result', async () => {
    const inngest = new Inngest({ id: 'inngest-agentic-workflow-final-output-tests' });
    const workflow = createInngestDurableAgenticWorkflow({ inngest });
    const entry = findEntry(
      (workflow as any).executionGraph.steps,
      entry => entry.type === 'mapping' && entry.id === 'map-final-output',
    );

    const usage = { inputTokens: 3, outputTokens: 5, totalTokens: 8 };
    const accumulatedSteps = [{ text: 'final answer' }];

    const result = await entry.mapConfig({
      inputData: {
        runId: 'run-1',
        accumulatedSteps,
        accumulatedUsage: usage,
        lastStepResult: { reason: 'stop', isContinued: false, warnings: [] },
        state: {},
        messageListState: new MessageList().serialize(),
      },
      getInitData: () => ({
        runId: 'run-1',
        agentId: 'agent-1',
        state: {},
        modelConfig: { provider: 'test', modelId: 'test-model' },
      }),
      engine: { step: { run: skipFinishSideEffects } },
      mastra: { getLogger: () => undefined },
    });

    expect(result.output).toEqual({ text: 'final answer', usage, steps: accumulatedSteps });
  });
});
