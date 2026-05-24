/**
 * Harness v1 — spawn_subagent built-in tool (§9).
 *
 * The tool is auto-registered when `HarnessConfig.subagents.types` is
 * non-empty. Invoking it should:
 *
 *   1. validate `agentType` against the registry,
 *   2. enforce the depth cap (`HarnessSubagentDepthExceededError`),
 *   3. create a fresh child session with `origin: 'subagent-tool'` and
 *      `parentSessionId` wired to the caller,
 *   4. bridge the child's per-turn events into the parent's subscriber
 *      stream as `subagent_*` shapes,
 *   5. track the child in `_activeSubagents` while running, and
 *   6. close the child + drop the entry once the tool returns.
 */

import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { buildFakeOutput } from './__test-utils__/fake-output';

import { createSpawnSubagentTool, SPAWN_SUBAGENT_TOOL_ID } from './builtin-tools/spawn-subagent';
import type { HarnessEvent } from './events';
import { Harness } from './harness';

class FakeAgent extends Agent<any, any, any> {
  chunks: any[] = [];
  lastMessages: any;
  lastStreamOptions: any;
  fullOutput: any = {
    text: 'child-result',
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    finishReason: 'stop',
    object: undefined,
    steps: [],
    warnings: [],
    providerMetadata: undefined,
    request: {},
    reasoning: [],
    reasoningText: undefined,
    toolCalls: [],
    toolResults: [],
    sources: [],
    files: [],
    response: { id: 'r', timestamp: new Date(), modelId: 'fake', messages: [], uiMessages: [] },
    totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    error: undefined,
    tripwire: undefined,
    traceId: undefined,
    spanId: undefined,
    runId: 'fake-run',
    suspendPayload: undefined,
    messages: [],
    rememberedMessages: [],
  };

  constructor(name: string) {
    super({ id: name, name, instructions: 'fake', model: 'openai/gpt-4o-mini' as any });
  }

  async stream(messages: any, options?: any): Promise<any> {
    this.lastMessages = messages;
    this.lastStreamOptions = options;
    const out = buildFakeOutput({
      runId: options?.runId ?? this.fullOutput.runId,
      fullOutput: this.fullOutput,
      chunks: this.chunks,
    });
    this._internalRegisterStreamRun(out, (options ?? {}) as any);
    return out;
  }

  async generate(_messages: any, _options?: any): Promise<any> {
    return this.fullOutput;
  }

  async resumeStream(_resumeData: any, options?: any): Promise<any> {
    return this.stream(undefined, options);
  }
}

function setup(opts?: {
  maxDepth?: number;
  chunks?: any[];
  allowedWorkspaceTools?: string[];
  forkedDefault?: boolean;
  /**
   * Permission profile applied to the subagent type's child session at
   * spawn time. When set, the child runs with the profile's per-category
   * baseline + session grants regardless of the parent's posture.
   */
  profile?: 'readOnlyReview' | 'approvalGatedPatch' | 'ciFixer' | 'trustedLocalYolo';
  /**
   * Retention policy for the `explore` subagent type. Many existing tests
   * inspect `storage.loadSession({ sessionId: child.id })` AFTER the tool
   * returns to verify configuration (modeId, modelId, parentSessionId,
   * etc.); under the production default `retain: false`, the row would be
   * deleted before those assertions could run. We default this helper to
   * `retain: true` so existing tests stay assertion-friendly. Tests that
   * specifically exercise the ephemeral-cleanup contract pass
   * `retain: false`.
   */
  retain?: boolean;
}) {
  const parentAgent = new FakeAgent('parent-agent');
  const childAgent = new FakeAgent('child-agent');
  if (opts?.chunks) childAgent.chunks = opts.chunks;
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const harness = new Harness({
    agents: { 'parent-agent': parentAgent, 'child-agent': childAgent } as any,
    modes: [
      { id: 'default', agentId: 'parent-agent' },
      { id: 'explore-mode', agentId: 'child-agent' },
    ],
    defaultModeId: 'default',
    sessions: { storage },
    subagents: {
      maxDepth: opts?.maxDepth ?? 2,
      types: {
        explore: {
          agentId: 'child-agent',
          modeId: 'explore-mode',
          description: 'Read-only codebase exploration',
          defaultModelId: 'openai/gpt-4o-mini',
          forked: opts?.forkedDefault,
          allowedWorkspaceTools: opts?.allowedWorkspaceTools,
          workspace: 'inherit',
          retain: opts?.retain ?? true,
          ...(opts?.profile !== undefined ? { profile: opts.profile } : {}),
        },
      },
    },
  });
  return { harness, parentAgent, childAgent, storage };
}

// Minimal mock execution context for direct tool.execute() calls.
function execCtx(toolCallId = 'tc-1') {
  return {
    abortSignal: new AbortController().signal,
    agent: { toolCallId, runId: 'run-1' },
    runId: 'run-1',
    tracingContext: {} as any,
    requestContext: { get: () => undefined } as any,
    mastra: undefined,
  } as any;
}

function execCtxWithWorkspace(toolCallId = 'tc-1') {
  return {
    ...execCtx(toolCallId),
    workspace: {
      getToolsConfig: () => ({
        mastra_workspace_read_file: { name: 'view' },
        mastra_workspace_list_files: { name: 'find_files' },
        mastra_workspace_write_file: { name: 'write_file' },
      }),
      filesystem: { readOnly: false },
    },
  } as any;
}

describe('spawn_subagent tool — registration', () => {
  it('is undefined when no subagent types are configured', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const agent = new FakeAgent('parent-agent');
    const harness = new Harness({
      agents: { 'parent-agent': agent } as any,
      modes: [{ id: 'default', agentId: 'parent-agent' }],
      defaultModeId: 'default',
      sessions: { storage },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const tool = createSpawnSubagentTool(session);
    expect(tool).toBeUndefined();
  });

  it('is registered with the canonical id when subagent types exist', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const tool = createSpawnSubagentTool(session);
    expect(tool).toBeDefined();
    expect(tool!.id).toBe(SPAWN_SUBAGENT_TOOL_ID);
  });
});

describe('spawn_subagent tool — execution', () => {
  it('rejects unknown agentType via input-schema validation', async () => {
    const { harness } = setup();
    const parent = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const tool = createSpawnSubagentTool(parent)!;

    const result = (await tool.execute!({ agentType: 'bogus', task: 'nope' } as any, execCtx())) as any;

    // The zod enum on `agentType` rejects unknown values before execute runs.
    // The tool framework returns a ValidationError object with `error: true`.
    expect(result.error).toBe(true);
    expect(typeof result.message).toBe('string');
    expect(result.message).toMatch(/agentType/);
  });

  it('enforces the subagent depth cap', async () => {
    const { harness } = setup({ maxDepth: 1 });
    // Manually mint a session sitting at depth=1 to simulate an already-
    // nested subagent. The next spawn would push to depth=2 > max=1.
    const parent = await harness.session({
      resourceId: 'u1',
      threadId: { fresh: true },
      subagentDepth: 1,
    });
    const tool = createSpawnSubagentTool(parent)!;

    const result = (await tool.execute!({ agentType: 'explore', task: 'go deeper' }, execCtx())) as any;

    expect(result.isError).toBe(true);
    expect(result.errorName).toBe('HarnessSubagentDepthExceededError');
    expect(result.depth).toBe(1);
    expect(result.maxDepth).toBe(1);
    expect(parent.subagentDepth).toBe(1);
  });

  it('rejects an empty modelOverride without creating a child session', async () => {
    const { harness } = setup();
    const parent = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const tool = createSpawnSubagentTool(parent)!;

    const result = (await tool.execute!(
      { agentType: 'explore', task: 'find usages of X', modelOverride: '' },
      execCtx(),
    )) as any;

    expect(result.isError).toBe(true);
    expect(result.errorName).toBe('HarnessValidationError');
    expect(result.field).toBe('modelOverride');
    expect(result.reason).toContain('non-empty string');
  });

  it('creates a fresh child session and returns subagentSessionId + result', async () => {
    const { harness, childAgent } = setup();
    childAgent.fullOutput = { ...childAgent.fullOutput, text: 'child says hi' };

    const parent = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const tool = createSpawnSubagentTool(parent)!;

    const result = (await tool.execute!({ agentType: 'explore', task: 'find usages of X' }, execCtx())) as any;

    expect(typeof result.subagentSessionId).toBe('string');
    expect(result.subagentSessionId).not.toBe(parent.id);
    expect(result.subagentSessionId.length).toBeGreaterThan(0);
  });

  it('uses a session subagent model override before the subagent type default', async () => {
    const { harness, storage, childAgent } = setup();
    const parent = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await parent.models.setSubagent({ agentType: 'explore', model: 'anthropic/claude-opus-4-6' });
    const tool = createSpawnSubagentTool(parent)!;

    const events: HarnessEvent[] = [];
    parent.subscribe(e => {
      events.push(e);
    });

    const result = (await tool.execute!({ agentType: 'explore', task: 'find usages of X' }, execCtx())) as any;

    const childRecord = await storage.loadSession({ sessionId: result.subagentSessionId });
    const start = events.find(e => e.type === 'subagent_start');
    expect(childRecord?.modelId).toBe('anthropic/claude-opus-4-6');
    expect((start as any).modelId).toBe('anthropic/claude-opus-4-6');
    expect(childAgent.lastStreamOptions.requestContext.get('harness')).toMatchObject({
      modelId: 'anthropic/claude-opus-4-6',
    });
  });

  it('emits subagent_start + subagent_end on the parent session', async () => {
    const { harness } = setup();
    const parent = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const tool = createSpawnSubagentTool(parent)!;

    const events: HarnessEvent[] = [];
    parent.subscribe(e => {
      events.push(e);
    });

    await tool.execute!({ agentType: 'explore', task: 'find usages of X' }, execCtx('tc-spawn-1'));

    const start = events.find(e => e.type === 'subagent_start');
    const end = events.find(e => e.type === 'subagent_end');
    expect(start).toBeDefined();
    expect(end).toBeDefined();
    expect((start as any).toolCallId).toBe('tc-spawn-1');
    expect((start as any).agentType).toBe('explore');
    expect((start as any).task).toBe('find usages of X');
    expect((start as any).depth).toBe(1);
    expect((end as any).toolCallId).toBe('tc-spawn-1');
    expect((end as any).isError).toBe(false);
    expect(typeof (end as any).durationMs).toBe('number');
  });

  it('clears _activeSubagents after the child completes', async () => {
    const { harness } = setup();
    const parent = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const tool = createSpawnSubagentTool(parent)!;

    await tool.execute!({ agentType: 'explore', task: 'go' }, execCtx('tc-active-1'));

    // After completion, the active map should be empty.
    const display = parent.getDisplayState();
    expect(display.activeSubagents).toEqual({});
  });

  it('child session is auto-closed after the tool returns', async () => {
    const { harness, storage } = setup();
    const parent = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const tool = createSpawnSubagentTool(parent)!;

    const result = (await tool.execute!({ agentType: 'explore', task: 'go' }, execCtx('tc-close-1'))) as any;

    const childId = result.subagentSessionId as string;
    const childRecord = await storage.loadSession({ sessionId: childId });
    expect(childRecord?.closedAt).toBeDefined();
  });

  it('filters model-visible workspace tools for subagents with allowedWorkspaceTools', async () => {
    const { harness, childAgent } = setup({ allowedWorkspaceTools: ['view', 'find_files'] });
    const parent = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const tool = createSpawnSubagentTool(parent)!;

    await tool.execute!({ agentType: 'explore', task: 'read only' }, execCtxWithWorkspace('tc-ws-filter'));

    expect(childAgent.lastStreamOptions?.prepareStep).toBeTypeOf('function');
    const result = childAgent.lastStreamOptions.prepareStep({
      tools: {
        view: {},
        find_files: {},
        write_file: {},
        shell: {},
      },
    });
    expect(result.activeTools).toEqual(expect.arrayContaining(['view', 'find_files', 'shell']));
    expect(result.activeTools).not.toContain('write_file');
  });

  it('returns a tool error when workspace tool construction fails', async () => {
    const { harness, storage } = setup({ allowedWorkspaceTools: ['view'] });
    const parent = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const tool = createSpawnSubagentTool(parent)!;

    const result = (await tool.execute!({ agentType: 'explore', task: 'read only' }, {
      ...execCtx('tc-ws-error'),
      workspace: {
        getToolsConfig: () => {
          throw new Error('workspace unavailable');
        },
        filesystem: { readOnly: false },
      },
    } as any)) as any;

    expect(result).toMatchObject({
      isError: true,
      errorName: 'Error',
      message: 'workspace unavailable',
      result: undefined,
    });
    expect(result.subagentSessionId).toBeTruthy();
    const childRecord = await storage.loadSession({ sessionId: result.subagentSessionId });
    expect(childRecord?.closedAt).toBeDefined();
  });

  it('forks by cloning the parent thread and running on the parent mode/model', async () => {
    const { harness, parentAgent, childAgent, storage } = setup();
    const parentThread = await harness.threads.create({ resourceId: 'u1', title: 'parent' });
    const parent = await harness.session({ resourceId: 'u1', threadId: parentThread.id });
    await parent.models.switch({ model: 'openai/gpt-4o' });
    const tool = createSpawnSubagentTool(parent)!;

    const events: HarnessEvent[] = [];
    parent.subscribe(e => {
      events.push(e);
    });

    const result = (await tool.execute!(
      { agentType: 'explore', task: 'inspect context-dependent code', forked: true, modelOverride: 'ignored-model' },
      {
        ...execCtx('tc-fork'),
        agent: {
          toolCallId: 'tc-fork',
          runId: 'run-1',
          flushMessages: async () => undefined,
        },
      } as any,
    )) as any;

    expect(typeof result.subagentSessionId).toBe('string');
    expect(parentAgent.lastStreamOptions?.memory?.thread).toBeDefined();
    expect(parentAgent.lastStreamOptions.memory.thread).not.toBe(parent.threadId);
    expect(parentAgent.lastStreamOptions.memory.resource).toBe(parent.resourceId);
    expect(parentAgent.lastStreamOptions.requestContext.get('harness')).toMatchObject({
      threadId: parentAgent.lastStreamOptions.memory.thread,
      resourceId: parent.resourceId,
      modeId: 'default',
      modelId: 'openai/gpt-4o',
      source: 'subagent',
      parentSessionId: parent.id,
    });
    expect(parentAgent.lastStreamOptions.requireToolApproval).toBe(true);
    expect(childAgent.lastStreamOptions).toBeUndefined();

    const childRecord = await storage.loadSession({ sessionId: result.subagentSessionId });
    expect(childRecord).toMatchObject({
      parentSessionId: parent.id,
      origin: 'subagent-tool',
      ownsThread: false,
      modeId: 'default',
      modelId: 'openai/gpt-4o',
      subagentDepth: 1,
    });
    expect(childRecord?.threadId).toBe(parentAgent.lastStreamOptions.memory.thread);

    const clone = await harness.threads.get({ resourceId: parent.resourceId, threadId: childRecord!.threadId });
    expect(clone?.metadata).toMatchObject({ forkedSubagent: true, parentThreadId: parent.threadId });

    const start = events.find(e => e.type === 'subagent_start') as any;
    expect(start).toMatchObject({
      toolCallId: 'tc-fork',
      agentType: 'explore',
      modelId: 'openai/gpt-4o',
      forked: true,
    });
  });

  it('forks by default when the subagent definition sets forked=true', async () => {
    const { harness, parentAgent, childAgent } = setup({ forkedDefault: true });
    const parentThread = await harness.threads.create({ resourceId: 'u1', title: 'parent' });
    const parent = await harness.session({ resourceId: 'u1', threadId: parentThread.id });
    const tool = createSpawnSubagentTool(parent)!;

    await tool.execute!({ agentType: 'explore', task: 'use parent context' }, execCtx('tc-fork-default'));

    expect(parentAgent.lastStreamOptions?.memory?.thread).toBeDefined();
    expect(parentAgent.lastStreamOptions.memory.thread).not.toBe(parent.threadId);
    expect(childAgent.lastStreamOptions).toBeUndefined();
  });

  it('lets per-call forked=false override a forked subagent definition default', async () => {
    const { harness, parentAgent, childAgent } = setup({ forkedDefault: true });
    const parentThread = await harness.threads.create({ resourceId: 'u1', title: 'parent' });
    const parent = await harness.session({ resourceId: 'u1', threadId: parentThread.id });
    const tool = createSpawnSubagentTool(parent)!;

    await tool.execute!({ agentType: 'explore', task: 'isolated work', forked: false }, execCtx('tc-fork-off'));

    expect(childAgent.lastStreamOptions?.memory?.thread).toBeDefined();
    expect(childAgent.lastStreamOptions.memory.thread).not.toBe(parent.threadId);
    expect(parentAgent.lastStreamOptions).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Retention policy — default ephemeral + opt-in retain
// ---------------------------------------------------------------------------

describe('spawn_subagent tool — retention policy', () => {
  it('deletes the child session row after subagent_end by default (retain unset)', async () => {
    // setup({retain: false}) opts the test subagent type into the production
    // default of ephemeral cleanup.
    const { harness, storage } = setup({ retain: false });
    const parent = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const tool = createSpawnSubagentTool(parent)!;

    const result = (await tool.execute!({ agentType: 'explore', task: 'run' }, execCtx('tc-ephemeral'))) as any;

    expect(typeof result.subagentSessionId).toBe('string');
    expect(result.subagentSessionId).not.toBe('');
    const childRow = await storage.loadSession({ sessionId: result.subagentSessionId });
    expect(childRow).toBeNull();
  });

  it('preserves the child session row when retain: true', async () => {
    const { harness, storage } = setup({ retain: true });
    const parent = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const tool = createSpawnSubagentTool(parent)!;

    const result = (await tool.execute!({ agentType: 'explore', task: 'run' }, execCtx('tc-retain'))) as any;

    const childRow = await storage.loadSession({ sessionId: result.subagentSessionId });
    expect(childRow).not.toBeNull();
    expect(childRow?.closedAt).toBeDefined();
  });

  it('still emits subagent_end before the cleanup deletes the row', async () => {
    // Regression: the cleanup MUST run AFTER `subagent_end` is emitted so
    // subscribers can observe the event before the row vanishes.
    const { harness } = setup({ retain: false });
    const parent = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const tool = createSpawnSubagentTool(parent)!;

    const events: HarnessEvent[] = [];
    parent.subscribe(e => {
      events.push(e);
    });

    await tool.execute!({ agentType: 'explore', task: 'run' }, execCtx('tc-event-order'));

    const end = events.find(e => e.type === 'subagent_end') as any;
    expect(end).toBeDefined();
    expect(end.subagentSessionId).toMatch(/^sess-/);
    expect(end.toolCallId).toBe('tc-event-order');
  });

  it('also cleans the child row when workspace-tool construction fails on the early-return path', async () => {
    // Regression: codex review surfaced that the workspace-tool-construction
    // catch path closes the child and returns BEFORE the main `finally`
    // retention block runs. Under default `retain: false`, that path must
    // still delete the row or workspace/provider failures in fan-out
    // workloads keep accumulating closed children.
    const { harness, storage } = setup({ retain: false, allowedWorkspaceTools: ['view'] });
    const parent = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const tool = createSpawnSubagentTool(parent)!;

    const result = (await tool.execute!({ agentType: 'explore', task: 'read only' }, {
      ...execCtx('tc-ws-error-cleanup'),
      workspace: {
        getToolsConfig: () => {
          throw new Error('workspace unavailable');
        },
        filesystem: { readOnly: false },
      },
    } as any)) as any;

    expect(result).toMatchObject({ isError: true, message: 'workspace unavailable' });
    expect(typeof result.subagentSessionId).toBe('string');
    expect(result.subagentSessionId.length).toBeGreaterThan(0);
    const childRow = await storage.loadSession({ sessionId: result.subagentSessionId });
    expect(childRow).toBeNull();
  });

  it('also deletes the child thread row alongside the session row by default', async () => {
    // Follow-up to the initial retention commit: cleaning the session
    // row alone left the cloned/fresh thread and its messages behind.
    // The cleanup now calls `harness.threads.delete` too.
    const { harness, storage } = setup({ retain: false });
    const parent = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const threadsDelete = vi.spyOn(harness.threads, 'delete');
    const tool = createSpawnSubagentTool(parent)!;

    const result = (await tool.execute!({ agentType: 'explore', task: 'run' }, execCtx('tc-thread-cleanup'))) as any;

    expect(typeof result.subagentSessionId).toBe('string');
    expect(threadsDelete).toHaveBeenCalled();
    // The child has a fresh thread (not the parent's); the delete must
    // target that thread, not the parent's.
    const callArg = threadsDelete.mock.calls[0]?.[0] as { resourceId: string; threadId: string };
    expect(callArg.resourceId).toBe('u1');
    expect(callArg.threadId).not.toBe(parent.threadId);
    // The session row is gone too (covered by an earlier test); we
    // additionally confirm here that storage no longer lists the child.
    const childRow = await storage.loadSession({ sessionId: result.subagentSessionId });
    expect(childRow).toBeNull();
  });

  it('does not delete the thread row when retain: true', async () => {
    const { harness } = setup({ retain: true });
    const parent = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const threadsDelete = vi.spyOn(harness.threads, 'delete');
    const tool = createSpawnSubagentTool(parent)!;
    await tool.execute!({ agentType: 'explore', task: 'run' }, execCtx('tc-retain-thread'));
    expect(threadsDelete).not.toHaveBeenCalled();
  });

  it('also deletes the thread on the workspace-tool-construction early-return path', async () => {
    const { harness } = setup({ retain: false, allowedWorkspaceTools: ['view'] });
    const parent = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const threadsDelete = vi.spyOn(harness.threads, 'delete');
    const tool = createSpawnSubagentTool(parent)!;

    const result = (await tool.execute!({ agentType: 'explore', task: 'read only' }, {
      ...execCtx('tc-ws-thread-cleanup'),
      workspace: {
        getToolsConfig: () => {
          throw new Error('workspace unavailable');
        },
        filesystem: { readOnly: false },
      },
    } as any)) as any;

    expect(result).toMatchObject({ isError: true });
    expect(threadsDelete).toHaveBeenCalled();
  });

  it('leaves no orphan session rows after a bulk-spawn workload (default ephemeral)', async () => {
    // The Linear acceptance criterion: a workflow that spawns many
    // ephemeral subagents and runs to completion leaves zero closed
    // subagent sessions in storage by default.
    const { harness, storage } = setup({ retain: false });
    const parent = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const tool = createSpawnSubagentTool(parent)!;

    const N = 25;
    for (let i = 0; i < N; i++) {
      await tool.execute!({ agentType: 'explore', task: `task-${i}` }, execCtx(`tc-bulk-${i}`));
    }

    const childRecords = await storage.listSessions({
      resourceId: 'u1',
      parentSessionId: parent.id,
      includeClosed: true,
    });
    expect(childRecords).toEqual([]);
  });
});

describe('spawn_subagent tool — profile binding', () => {
  it("applies the subagent type's profile to the child session before the first turn", async () => {
    // Permission profile binding: a subagent type can declare
    // `profile: 'readOnlyReview'`, and the spawn path applies the profile to
    // the child session BEFORE child.message() runs so every tool the child can
    // invoke is gated by the profile's category/tool posture — not just
    // workspace tools filtered by `allowedWorkspaceTools`.
    //
    // The applied profile is observable on the persisted child
    // session row (rules + grants + appliedPermissionProfile). The
    // resolver's per-category gating behavior is pinned by the
    // permission-profiles + actor-grants slices; this test confirms
    // the spawn path actually CALLS applyProfile and the resulting
    // state survives to storage.
    const { harness, storage } = setup({ profile: 'readOnlyReview' });
    const parent = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const tool = createSpawnSubagentTool(parent)!;
    const result = (await tool.execute!({ agentType: 'explore', task: 'read' }, execCtxWithWorkspace('tc-1'))) as any;
    expect(result.isError).toBeFalsy();
    const stored = await storage.loadSession({ sessionId: result.subagentSessionId });
    expect(stored?.appliedPermissionProfile).toBe('readOnlyReview');
    expect(stored?.permissionRules.categories.read).toBe('allow');
    expect(stored?.permissionRules.categories.edit).toBe('deny');
    expect(stored?.permissionRules.categories.execute).toBe('deny');
    expect(stored?.permissionRules.categories.mcp).toBe('deny');
    // The reset cleared the session-level grants (profile reset is
    // replace-not-merge — covered in permission-profiles tests).
    expect(stored?.sessionGrants).toEqual({ categories: [], tools: [] });
  });

  it('emits permission_profile_applied on the harness emitter (audit-visible)', async () => {
    const { harness } = setup({ profile: 'approvalGatedPatch' });
    const parent = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const events: any[] = [];
    harness.subscribe(e => events.push(e));
    const tool = createSpawnSubagentTool(parent)!;
    await tool.execute!({ agentType: 'explore', task: 'review' }, execCtxWithWorkspace('tc-2'));
    const applied = events.find(e => e.type === 'permission_profile_applied');
    expect(applied).toBeDefined();
    expect((applied as any).profileName).toBe('approvalGatedPatch');
  });

  it('does not bypass child permission profiles for forked subagents', async () => {
    const { harness, parentAgent } = setup({ profile: 'approvalGatedPatch' });
    const parentThread = await harness.threads.create({ resourceId: 'u1', title: 'parent' });
    const parent = await harness.session({ resourceId: 'u1', threadId: parentThread.id });
    const tool = createSpawnSubagentTool(parent)!;

    await tool.execute!(
      { agentType: 'explore', task: 'review edits', forked: true },
      execCtxWithWorkspace('tc-profile-fork'),
    );

    expect(parentAgent.lastStreamOptions?.requireToolApproval).toBe(true);
  });

  it("subagent type without profile leaves the child session's rules untouched (legacy behavior)", async () => {
    const { harness, storage } = setup({}); // no profile
    const parent = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const tool = createSpawnSubagentTool(parent)!;
    const result = (await tool.execute!({ agentType: 'explore', task: 'do' }, execCtxWithWorkspace('tc-3'))) as any;
    const stored = await storage.loadSession({ sessionId: result.subagentSessionId });
    expect(stored?.appliedPermissionProfile).toBeUndefined();
  });
});
