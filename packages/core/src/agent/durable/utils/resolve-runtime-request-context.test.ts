/**
 * Durable request-context fallback across the cross-process boundary (issue #20210).
 *
 * On a cross-process engine (e.g. the @mastra/inngest connect() worker) the
 * durable steps run in a DIFFERENT process than the one that prepared the run.
 * The workflow input's `requestContextEntries` snapshot is NOT propagated onto
 * the step's input there — @mastra/inngest forwards the caller context as the
 * run-level `event.data.requestContext`, from which the durable workflow rebuilds
 * a populated run-level `RequestContext`.
 *
 * Before the fix, `resolveRuntimeDependencies` / `rebuildRunToolsFromMastra`
 * read only `input.requestContextEntries` and, finding it absent, rebuilt the
 * toolset with an EMPTY context — so a subagent delegated to from the tool-call
 * step lost the caller's tenant/user/workspace values. The fix falls back to the
 * run-level `RequestContext` (threaded from the step's params) when the snapshot
 * is missing. These tests guard that fallback at the root-cause functions.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestContext } from '../../../request-context';
import { MessageList } from '../../message-list';
import { globalRunRegistry } from '../run-registry';
import { rebuildRunToolsFromMastra, resolveRuntimeDependencies } from './resolve-runtime';

const RUN_ID = 'run-reqctx-fallback-1';

/** Build a RequestContext carrying a single tenant value. */
function runCtx(tenant: string): RequestContext {
  return new RequestContext([['tenant', tenant]] as Iterable<readonly [string, unknown]>);
}

/** A fake agent that records the requestContext it was resolved with. */
function makeRecordingAgent() {
  const seen: { tools?: RequestContext; memory?: RequestContext; workspace?: RequestContext } = {};
  const agent = {
    getToolsForExecution: vi.fn(async ({ requestContext }: { requestContext: RequestContext }) => {
      seen.tools = requestContext;
      return {};
    }),
    getModel: vi.fn(async () => ({
      provider: 'test',
      modelId: 'test',
      specificationVersion: 'v2',
      supportedUrls: {},
      doGenerate: vi.fn(),
      doStream: vi.fn(),
    })),
    getModelList: vi.fn(async () => null),
    getMemory: vi.fn(async ({ requestContext }: { requestContext: RequestContext }) => {
      seen.memory = requestContext;
      return undefined;
    }),
    getWorkspace: vi.fn(async ({ requestContext }: { requestContext: RequestContext }) => {
      seen.workspace = requestContext;
      return undefined;
    }),
    listInputProcessors: vi.fn(async () => []),
    __listLLMRequestProcessors: vi.fn(async () => []),
    listOutputProcessors: vi.fn(async () => []),
    listErrorProcessors: vi.fn(async () => []),
  };
  return { agent, seen };
}

function makeMastra(agent: unknown) {
  return {
    getAgentById: () => agent,
    getLogger: () => undefined,
  } as any;
}

function makeInput() {
  return {
    runId: RUN_ID,
    agentId: 'supervisor',
    // No requestContextEntries — simulating the cross-process worker where the
    // workflow-input snapshot was not propagated onto the step input.
    state: { threadId: 'thread-1', resourceId: 'user-1', memoryConfig: undefined, threadExists: false },
    options: {},
    modelConfig: { provider: 'test', modelId: 'test' },
    // A real serialized empty MessageList — hand-crafting the shape omits the
    // source-tracking fields deserialize() expects.
    messageListState: new MessageList({ threadId: 'thread-1', resourceId: 'user-1' }).serialize(),
  } as any;
}

afterEach(() => {
  if (globalRunRegistry.has(RUN_ID)) globalRunRegistry.delete(RUN_ID);
  vi.clearAllMocks();
});

describe('durable request-context cross-process fallback', () => {
  it('resolveRuntimeDependencies falls back to the run-level RequestContext when no snapshot is present', async () => {
    const { agent, seen } = makeRecordingAgent();
    const runLevel = runCtx('team-42');

    await resolveRuntimeDependencies({
      mastra: makeMastra(agent),
      runId: RUN_ID,
      agentId: 'supervisor',
      input: makeInput(),
      requestContext: runLevel,
    });

    // Tools / memory / workspace all resolved with the caller's tenant, not an empty context.
    expect(seen.tools?.get('tenant')).toBe('team-42');
    expect(seen.memory?.get('tenant')).toBe('team-42');
    expect(seen.workspace?.get('tenant')).toBe('team-42');
  });

  it('rebuildRunToolsFromMastra falls back to the run-level RequestContext when no snapshot is present', async () => {
    const { agent, seen } = makeRecordingAgent();
    const runLevel = runCtx('team-42');

    await rebuildRunToolsFromMastra({
      mastra: makeMastra(agent),
      runId: RUN_ID,
      agentId: 'supervisor',
      state: { threadId: 'thread-1', resourceId: 'user-1', memoryConfig: undefined, threadExists: false } as any,
      // requestContextEntries intentionally omitted (cross-process worker)
      requestContext: runLevel,
    });

    expect(seen.tools?.get('tenant')).toBe('team-42');
    expect(seen.workspace?.get('tenant')).toBe('team-42');
  });

  it('prefers the explicit snapshot over the run-level fallback when both are present', async () => {
    const { agent, seen } = makeRecordingAgent();
    const runLevel = runCtx('run-level');

    await rebuildRunToolsFromMastra({
      mastra: makeMastra(agent),
      runId: RUN_ID,
      agentId: 'supervisor',
      state: { threadId: 'thread-1', resourceId: 'user-1', memoryConfig: undefined, threadExists: false } as any,
      requestContextEntries: { tenant: 'snapshot' },
      requestContext: runLevel,
    });

    // The workflow-input snapshot is authoritative; the run-level fallback only fills the gap.
    expect(seen.tools?.get('tenant')).toBe('snapshot');
  });

  it('resolves with an empty context when neither snapshot nor run-level context is available', async () => {
    const { agent, seen } = makeRecordingAgent();

    await rebuildRunToolsFromMastra({
      mastra: makeMastra(agent),
      runId: RUN_ID,
      agentId: 'supervisor',
      state: { threadId: 'thread-1', resourceId: 'user-1', memoryConfig: undefined, threadExists: false } as any,
    });

    expect(seen.tools?.get('tenant')).toBeUndefined();
  });
});
