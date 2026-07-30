/**
 * Durable tool-call: cross-process workspace/skill tool resolution (issue #19330).
 *
 * On a cross-process engine (e.g. the @mastra/inngest connect() worker) the
 * durable tool-call step runs in a DIFFERENT process than the one that prepared
 * the run, so this process's `globalRunRegistry` has no entry (or a minimal
 * placeholder) for the run. Workspace/skill tools (`skill`, `skill_read`,
 * `skill_search`, `mastra_workspace_*`) are per-request closures that are NOT
 * registered at the Mastra-instance level, so the registry + `resolveTool` +
 * `listTools` lookups all miss them and the call rejects with ToolNotFoundError.
 *
 * The fix: when those lookups miss, the tool-call step rebuilds the toolset from
 * the agent via `rebuildRunToolsFromMastra` (mirroring what the LLM-execution
 * step already does through `resolveRuntimeDependencies`) and retries. These
 * tests guard that fallback.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import { globalRunRegistry } from '../../run-registry';
import * as resolveRuntime from '../../utils/resolve-runtime';
import { createDurableToolCallStep } from './tool-call';

vi.mock('../../utils/resolve-runtime', () => ({
  resolveTool: vi.fn().mockReturnValue(undefined),
  toolRequiresApproval: vi.fn().mockResolvedValue(false),
  rebuildRunToolsFromMastra: vi.fn(),
}));

vi.mock('../../stream-adapter', () => ({
  emitChunkEvent: vi.fn().mockResolvedValue(undefined),
  emitSuspendedEvent: vi.fn().mockResolvedValue(undefined),
}));

const RUN_ID = 'run-xproc-workspace-1';

function mockPubsub() {
  return { publish: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), flush: vi.fn() };
}

function makeInitData() {
  return {
    runId: RUN_ID,
    agentId: 'greeter',
    options: { requireToolApproval: false },
    state: { threadId: 'thread-1', resourceId: 'user-1', memoryConfig: undefined, threadExists: false },
  };
}

afterEach(() => {
  if (globalRunRegistry.has(RUN_ID)) globalRunRegistry.delete(RUN_ID);
  vi.clearAllMocks();
});

describe('durable tool-call cross-process workspace tool resolution', () => {
  it('rebuilds the workspace `skill` tool from Mastra when the run registry is empty', async () => {
    // Simulate the connect() worker: no registry entry for this run at all.
    expect(globalRunRegistry.has(RUN_ID)).toBe(false);

    const workspace = { id: 'ws-1' } as any;
    const executeMock = vi.fn().mockResolvedValue({ content: 'Hello, wonderful human!' });
    vi.mocked(resolveRuntime.rebuildRunToolsFromMastra).mockResolvedValueOnce({
      tools: { skill: { id: 'skill', execute: executeMock } as any },
      workspace,
    });

    const step = createDurableToolCallStep();
    const result = await (step as any).execute({
      inputData: { toolCallId: 'call-skill', toolName: 'skill', args: { name: 'greeting' } },
      mastra: { getLogger: () => undefined, listTools: () => ({}) },
      suspend: vi.fn(),
      resumeData: undefined,
      requestContext: new Map(),
      getInitData: () => makeInitData(),
      [PUBSUB_SYMBOL]: mockPubsub(),
    });

    // The rebuild fallback was consulted with the run's identifiers…
    expect(resolveRuntime.rebuildRunToolsFromMastra).toHaveBeenCalledWith(
      expect.objectContaining({ runId: RUN_ID, agentId: 'greeter' }),
    );
    // …and the `skill` tool it returned was executed with the workspace forwarded.
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][1]).toEqual(expect.objectContaining({ workspace }));
    expect(result.error).toBeUndefined();
    expect(result.result).toEqual({ content: 'Hello, wonderful human!' });
  });

  it('still emits ToolNotFoundError when the Mastra rebuild also has no such tool', async () => {
    globalRunRegistry.set(RUN_ID, { isPlaceholder: true, tools: {}, model: undefined as any } as any); // placeholder (inngest resume path)
    vi.mocked(resolveRuntime.rebuildRunToolsFromMastra).mockResolvedValueOnce({
      tools: { skill: { id: 'skill', execute: vi.fn() } as any },
      workspace: undefined,
    });

    const step = createDurableToolCallStep();
    const result = await (step as any).execute({
      inputData: { toolCallId: 'call-missing', toolName: 'not_a_real_tool', args: {} },
      mastra: { getLogger: () => undefined, listTools: () => ({}) },
      suspend: vi.fn(),
      resumeData: undefined,
      requestContext: new Map(),
      getInitData: () => makeInitData(),
      [PUBSUB_SYMBOL]: mockPubsub(),
    });

    expect(result.error).toEqual(expect.objectContaining({ name: 'ToolNotFoundError' }));
  });

  it('does not call the Mastra rebuild when the tool already resolves from the run registry', async () => {
    const executeMock = vi.fn().mockResolvedValue({ ok: true });
    globalRunRegistry.set(RUN_ID, {
      tools: { skill: { id: 'skill', execute: executeMock } as any },
      model: {} as any,
    } as any);

    const step = createDurableToolCallStep();
    const result = await (step as any).execute({
      inputData: { toolCallId: 'call-inproc', toolName: 'skill', args: { name: 'greeting' } },
      mastra: { getLogger: () => undefined, listTools: () => ({}) },
      suspend: vi.fn(),
      resumeData: undefined,
      requestContext: new Map(),
      getInitData: () => makeInitData(),
      [PUBSUB_SYMBOL]: mockPubsub(),
    });

    expect(resolveRuntime.rebuildRunToolsFromMastra).not.toHaveBeenCalled();
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(result.result).toEqual({ ok: true });
  });
});
