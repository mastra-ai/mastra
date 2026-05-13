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

import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { buildFakeOutput } from './__test-utils__/fake-output';

import type { HarnessEvent } from './events';
import { Harness } from './harness';
import { createSpawnSubagentTool, SPAWN_SUBAGENT_TOOL_ID } from './spawn-subagent-tool';

class FakeAgent extends Agent<any, any, any> {
  chunks: any[] = [];
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

  async stream(_messages: any, options?: any): Promise<any> {
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

function setup(opts?: { maxDepth?: number; chunks?: any[] }) {
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
          workspace: 'inherit',
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
});
