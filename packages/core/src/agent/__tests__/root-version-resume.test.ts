/**
 * Root-agent version stability across suspend/resume.
 *
 * A root agent selected by *status* (`{ status: 'published' }`) hot-switches to the
 * latest published version on every new run — that is the point of a status selector.
 * A run that already suspended must not hot-switch mid-flight: it has messages,
 * instructions and tool definitions from the version it started on, so resuming it on a
 * newly published version silently changes behavior underneath a human approver.
 *
 * These tests pin the exact version resolved at run start into the suspend payload and
 * assert the resume re-resolves to that exact id, while new runs still pick up the latest.
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { RequestContext, MASTRA_VERSIONS_KEY } from '../../request-context';
import { createVersionLabelError, InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

function createModel() {
  let callCount = 0;
  return new MockLanguageModelV2({
    doGenerate: async () => {
      callCount++;
      if (callCount % 2 === 1) {
        return {
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: `call-${callCount}`,
              toolName: 'findUserTool',
              input: '{"name":"Dero Israel"}',
            },
          ],
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          warnings: [],
        };
      }
      return {
        content: [{ type: 'text' as const, text: 'User found' }],
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        warnings: [],
      };
    },
    doStream: async () => {
      callCount++;
      // Odd turns open a tool call (the first turn of each run), even turns answer after
      // the approval resumes — so a single model instance can serve several runs.
      if (callCount % 2 === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: `call-${callCount}`,
              toolName: 'findUserTool',
              input: '{"name":"Dero Israel"}',
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'User found' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
        ]),
      };
    },
  });
}

function createFindUserTool() {
  return createTool({
    id: 'findUserTool',
    description: 'Returns the name and email of a user',
    inputSchema: z.object({ name: z.string() }),
    requireApproval: true,
    execute: async ({ name }: { name: string }) => ({ name, email: 'dero@mail.com' }),
  });
}

/**
 * Builds a Mastra whose editor resolves `{ status: 'published' }` to whatever
 * `currentPublished()` returns at call time — the mid-suspension publish is simulated by
 * flipping that value. `applyStoredOverrides` is the spy under test: it receives the exact
 * selector `Agent#execute` decided on.
 */
function setup() {
  let published = 'v1';
  let deleted: string | undefined;
  const applyStoredOverrides = vi.fn(async (agent: Agent, selector: any) => {
    const versionId = 'versionId' in selector && selector.versionId ? selector.versionId : published;
    if (deleted && versionId === deleted) {
      throw createVersionLabelError('VERSION_NOT_FOUND', { entityId: agent.id, versionId });
    }
    const fork = agent.__fork();
    fork.__setRawConfig({
      ...(agent.toRawConfig() ?? {}),
      resolvedVersionId: versionId,
      ...('label' in selector && selector.label ? { selectedVersionLabel: selector.label } : {}),
    });
    return fork;
  });

  const agent = new Agent({
    id: 'versioned-agent',
    name: 'Versioned Agent',
    instructions: 'You find users.',
    model: createModel(),
    tools: { findUserTool: createFindUserTool() },
  });

  const mastra = new Mastra({ agents: { agent }, logger: false, storage: new InMemoryStore() });
  vi.spyOn(mastra, 'getEditor').mockReturnValue({ agent: { applyStoredOverrides } } as any);

  return {
    agent,
    mastra,
    applyStoredOverrides,
    publish: (v: string) => {
      published = v;
    },
    deleteVersion: (v: string) => {
      deleted = v;
    },
    selectorsFor: (agentId: string) =>
      applyStoredOverrides.mock.calls.filter(([a]) => a.id === agentId).map(([, selector]) => selector),
  };
}

async function suspendOnApproval(agent: Agent, requestContext: RequestContext, threadId: string) {
  const stream = await agent.stream('Find the user with name - Dero Israel', {
    requestContext,
    memory: { thread: threadId, resource: 'resource-1' },
  });
  let toolCallId = '';
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'tool-call-approval') toolCallId = chunk.payload.toolCallId;
  }
  expect(toolCallId).toBeTruthy();
  return { runId: stream.runId, toolCallId };
}

async function suspendGenerateOnApproval(agent: Agent, requestContext: RequestContext, threadId: string) {
  const output = await agent.generate('Find the user with name - Dero Israel', {
    requestContext,
    memory: { thread: threadId, resource: 'resource-1' },
  });
  expect(output.finishReason).toBe('suspended');
  expect(output.suspendPayload?.toolCallId).toBeTruthy();
  return { runId: output.runId!, toolCallId: output.suspendPayload.toolCallId as string };
}

async function drain(stream: { fullStream: AsyncIterable<unknown> }) {
  for await (const _chunk of stream.fullStream) {
    // consume
  }
}

function stripSnapshotVersionPins(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const entry of value) stripSnapshotVersionPins(entry);
    return;
  }
  const record = value as Record<string, unknown>;
  delete record.__agentVersionPins;
  delete record.__agentVersionId;
  delete record.agentVersionPins;
  for (const entry of Object.values(record)) stripSnapshotVersionPins(entry);
}

async function mutateSnapshot(
  mastra: Mastra,
  runId: string,
  mutate: (snapshot: Record<string, any>) => void,
): Promise<void> {
  const workflows = (await mastra.getStorage()!.getStore('workflows'))!;
  const run = await workflows.getWorkflowRunById({ workflowName: 'agentic-loop', runId });
  expect(run).not.toBeNull();
  const snapshot = run!.snapshot as Record<string, any>;
  mutate(snapshot);
  await workflows.persistWorkflowSnapshot({
    workflowName: 'agentic-loop',
    runId,
    resourceId: 'resource-1',
    snapshot: snapshot as any,
  });
}

function getSuspendedStep(snapshot: Record<string, any>): Record<string, any> {
  const step = Object.values(snapshot.context as Record<string, any>).find(
    (candidate: any) => candidate?.status === 'suspended',
  ) as Record<string, any> | undefined;
  expect(step).toBeDefined();
  step!.suspendPayload ??= {};
  return step!;
}

describe('root agent version pinning across suspend/resume', () => {
  it('resumes on the version the run suspended on, even after a newer version is published', async () => {
    const { agent, applyStoredOverrides, publish, selectorsFor } = setup();
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_VERSIONS_KEY, { agents: { 'versioned-agent': { status: 'published' } } });

    const { runId, toolCallId } = await suspendOnApproval(agent, requestContext, 'thread-1');
    expect(selectorsFor('versioned-agent')).toEqual([{ status: 'published' }]);

    // A new version is published while the run sits suspended awaiting approval.
    publish('v2');
    applyStoredOverrides.mockClear();

    await drain(await agent.approveToolCall({ runId, toolCallId }));

    // The resume must ask for the exact version the run started on, not the status selector.
    expect(selectorsFor('versioned-agent')).toEqual([{ versionId: 'v1' }]);
  });

  it('pins a root label across approval and rejects mutable or different continuation selectors', async () => {
    const { agent, applyStoredOverrides, publish, selectorsFor } = setup();
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_VERSIONS_KEY, { self: { label: 'production' } });

    const { runId, toolCallId } = await suspendOnApproval(agent, requestContext, 'thread-label');
    expect(selectorsFor('versioned-agent')).toEqual([{ label: 'production' }]);

    publish('v2');
    applyStoredOverrides.mockClear();

    await expect(
      agent.approveToolCall({ runId, toolCallId, versions: { self: { label: 'production' } } }),
    ).rejects.toMatchObject({ id: 'PINNED_VERSION_CONFLICT' });
    await expect(
      agent.approveToolCall({ runId, toolCallId, versions: { self: { status: 'published' } } }),
    ).rejects.toMatchObject({ id: 'PINNED_VERSION_CONFLICT' });
    await expect(
      agent.approveToolCall({ runId, toolCallId, versions: { self: { versionId: 'v2' } } }),
    ).rejects.toMatchObject({ id: 'PINNED_VERSION_CONFLICT' });
    await expect(
      agent.approveToolCall({
        runId,
        toolCallId,
        versions: { self: { versionId: 'v1' }, defaultStatus: 'draft' },
      }),
    ).rejects.toMatchObject({ id: 'PINNED_VERSION_CONFLICT' });
    await expect(
      agent.approveToolCall({
        runId,
        toolCallId,
        versions: { self: { versionId: 'v1' }, agents: { other: { versionId: 'other-v1' } } },
      }),
    ).rejects.toMatchObject({ id: 'PINNED_VERSION_CONFLICT' });
    await expect(
      agent.approveToolCall({
        runId,
        toolCallId,
        versions: {
          self: { versionId: 'v1' },
          agents: { 'versioned-agent': { versionId: 'v2' } },
        },
      }),
    ).rejects.toMatchObject({ id: 'INVALID_VERSION_SELECTOR' });

    await drain(await agent.approveToolCall({ runId, toolCallId, versions: { self: { versionId: 'v1' } } }));
    expect(selectorsFor('versioned-agent')).toEqual([{ versionId: 'v1' }]);
  });

  it('still hot-switches new runs to the newly published version', async () => {
    const { agent, applyStoredOverrides, publish, selectorsFor } = setup();
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_VERSIONS_KEY, { agents: { 'versioned-agent': { status: 'published' } } });

    const { runId, toolCallId } = await suspendOnApproval(agent, requestContext, 'thread-1');
    publish('v2');
    await drain(await agent.approveToolCall({ runId, toolCallId }));

    applyStoredOverrides.mockClear();
    await suspendOnApproval(agent, requestContext, 'thread-2');

    // Status selector preserved for the new run, and it resolves to the latest publish.
    expect(selectorsFor('versioned-agent')).toEqual([{ status: 'published' }]);
    const fork = await applyStoredOverrides.mock.results[0]!.value;
    expect(fork.toRawConfig()?.resolvedVersionId).toBe('v2');
  });

  it("leaves the caller's requestContext holding the original status selector", async () => {
    const { agent, publish } = setup();
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_VERSIONS_KEY, { agents: { 'versioned-agent': { status: 'published' } } });

    const { runId, toolCallId } = await suspendOnApproval(agent, requestContext, 'thread-1');
    publish('v2');
    await drain(await agent.approveToolCall({ runId, toolCallId }));

    expect(requestContext.get(MASTRA_VERSIONS_KEY)).toEqual({
      agents: { 'versioned-agent': { status: 'published' } },
    });
  });

  it('keeps exact version selectors unchanged across resume', async () => {
    const { agent, applyStoredOverrides, publish, selectorsFor } = setup();
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_VERSIONS_KEY, { agents: { 'versioned-agent': { versionId: 'v1' } } });

    const { runId, toolCallId } = await suspendOnApproval(agent, requestContext, 'thread-1');
    publish('v2');
    applyStoredOverrides.mockClear();

    await drain(await agent.approveToolCall({ runId, toolCallId }));

    expect(selectorsFor('versioned-agent')).toEqual([{ versionId: 'v1' }]);
  });

  it('never resolves a version for a code-defined agent with no overrides', async () => {
    const { agent, applyStoredOverrides } = setup();

    const { runId, toolCallId } = await suspendOnApproval(agent, new RequestContext(), 'thread-1');
    await drain(await agent.approveToolCall({ runId, toolCallId }));

    expect(applyStoredOverrides).not.toHaveBeenCalled();
  });

  it('honors an explicit new-run selector on an already resolved stored agent', async () => {
    const { agent, mastra, applyStoredOverrides, selectorsFor } = setup();
    const resolvedV1 = await mastra.resolveVersionedAgent(agent, { versionId: 'v1' });
    applyStoredOverrides.mockClear();

    await resolvedV1.stream('Find the user', {
      memory: { thread: 'thread-explicit-override', resource: 'resource-1' },
      versions: { self: { versionId: 'v2' } },
    });
    expect(selectorsFor('versioned-agent')).toEqual([{ versionId: 'v2' }]);
  });

  it('rejects mutable dependency and default selectors on a legacy continuation with no pin payload', async () => {
    const { agent, mastra } = setup();
    const { runId, toolCallId } = await suspendOnApproval(agent, new RequestContext(), 'thread-legacy-no-pins');
    await mutateSnapshot(mastra, runId, snapshot => stripSnapshotVersionPins(snapshot));

    for (const versions of [
      { agents: { dependency: { versionId: 'dep-v1' } } },
      { agents: { dependency: { label: 'production' } } },
      { defaultStatus: 'published' },
      { self: { label: 'production' } },
    ] as const) {
      await expect(agent.approveToolCall({ runId, toolCallId, versions })).rejects.toMatchObject({
        id: 'PINNED_VERSION_REQUIRED',
      });
    }
  });

  it('fails closed when rootless structured pins meet an already resolved agent on resume', async () => {
    const { agent, mastra } = setup();
    const { runId, toolCallId } = await suspendOnApproval(agent, new RequestContext(), 'thread-rootless-pins');
    await mutateSnapshot(mastra, runId, snapshot => {
      stripSnapshotVersionPins(snapshot);
      const suspended = Object.values(snapshot.context as Record<string, any>).find(
        (step: any) => step?.status === 'suspended',
      ) as any;
      expect(suspended).toBeDefined();
      suspended.suspendPayload ??= {};
      suspended.suspendPayload.__agentVersionPins = { defaultStatus: 'published' };
    });
    const resolved = await mastra.resolveVersionedAgent(agent, { versionId: 'v2' });

    await expect(resolved.approveToolCall({ runId, toolCallId })).rejects.toMatchObject({
      id: 'PINNED_VERSION_CONFLICT',
    });
  });

  it('fails closed when the pinned version can no longer be resolved', async () => {
    // The persisted pin is an exact selector. If its immutable target disappears,
    // resuming must not silently continue on code defaults or a newer publication.
    const { agent, publish, deleteVersion } = setup();
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_VERSIONS_KEY, { agents: { 'versioned-agent': { status: 'published' } } });

    const { runId, toolCallId } = await suspendOnApproval(agent, requestContext, 'thread-1');
    publish('v2');
    deleteVersion('v1');

    await expect(agent.approveToolCall({ runId, toolCallId })).rejects.toMatchObject({
      id: 'VERSION_NOT_FOUND',
    });
  });

  it('direct resumeGenerate rejects a conflicting foreach pin before stored-agent lookup', async () => {
    const { agent, mastra, applyStoredOverrides } = setup();
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_VERSIONS_KEY, { self: { label: 'production' } });
    const { runId } = await suspendGenerateOnApproval(agent, requestContext, 'foreach-pin-conflict');

    await mutateSnapshot(mastra, runId, snapshot => {
      const step = getSuspendedStep(snapshot);
      step.suspendPayload.__workflow_meta = {
        ...(step.suspendPayload.__workflow_meta ?? {}),
        foreachOutput: [
          {
            status: 'suspended',
            suspendPayload: {
              __agentVersionPins: {
                root: { agentId: 'versioned-agent', versionId: 'v2', selectedLabel: 'production' },
              },
            },
          },
        ],
      };
    });
    applyStoredOverrides.mockClear();

    await expect(agent.resumeGenerate({ approved: true }, { runId })).rejects.toMatchObject({
      id: 'PINNED_VERSION_INVALID',
    });
    expect(applyStoredOverrides).not.toHaveBeenCalled();
  });

  it('direct resumeStream rejects a conflicting durable-input pin before stored-agent lookup', async () => {
    const { agent, mastra, applyStoredOverrides } = setup();
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_VERSIONS_KEY, { self: { label: 'production' } });
    const { runId } = await suspendOnApproval(agent, requestContext, 'input-pin-conflict');

    await mutateSnapshot(mastra, runId, snapshot => {
      (snapshot.context.input as Record<string, unknown>).agentVersionPins = {
        root: { agentId: 'versioned-agent', versionId: 'v1', selectedLabel: 'candidate' },
      };
    });
    applyStoredOverrides.mockClear();

    await expect(agent.resumeStream({ approved: true }, { runId })).rejects.toMatchObject({
      id: 'PINNED_VERSION_INVALID',
    });
    expect(applyStoredOverrides).not.toHaveBeenCalled();
  });

  it('accepts identical pin copies across suspended and durable-input payloads', async () => {
    const { agent, mastra, applyStoredOverrides, selectorsFor } = setup();
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_VERSIONS_KEY, { self: { label: 'production' } });
    const { runId, toolCallId } = await suspendGenerateOnApproval(agent, requestContext, 'identical-pin-copies');

    await mutateSnapshot(mastra, runId, snapshot => {
      (snapshot.context.input as Record<string, unknown>).agentVersionPins = {
        root: { agentId: 'versioned-agent', versionId: 'v1', selectedLabel: 'production' },
      };
    });
    applyStoredOverrides.mockClear();

    await expect(agent.resumeGenerate({ approved: true }, { runId, toolCallId })).resolves.toMatchObject({
      finishReason: 'stop',
    });
    expect(selectorsFor('versioned-agent')).toEqual([{ versionId: 'v1' }]);
  });

  it('direct resumeStream accepts identical suspended and durable-input pin copies', async () => {
    const { agent, mastra, applyStoredOverrides, selectorsFor } = setup();
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_VERSIONS_KEY, { self: { label: 'production' } });
    const { runId, toolCallId } = await suspendOnApproval(agent, requestContext, 'identical-stream-pin-copies');

    await mutateSnapshot(mastra, runId, snapshot => {
      (snapshot.context.input as Record<string, unknown>).agentVersionPins = {
        root: { agentId: 'versioned-agent', versionId: 'v1', selectedLabel: 'production' },
      };
    });
    applyStoredOverrides.mockClear();

    await drain(await agent.resumeStream({ approved: true }, { runId, toolCallId }));
    expect(selectorsFor('versioned-agent')).toEqual([{ versionId: 'v1' }]);
  });

  it('rejects a rootless persisted owner dependency before stored-agent lookup', async () => {
    const { agent, mastra, applyStoredOverrides } = setup();
    const { runId } = await suspendGenerateOnApproval(agent, new RequestContext(), 'rootless-owner-dependency');
    await mutateSnapshot(mastra, runId, snapshot => {
      stripSnapshotVersionPins(snapshot);
      getSuspendedStep(snapshot).suspendPayload.__agentVersionPins = {
        agents: { 'versioned-agent': { agentId: 'versioned-agent', versionId: 'v1' } },
      };
    });
    applyStoredOverrides.mockClear();

    await expect(agent.resumeGenerate({ approved: true }, { runId })).rejects.toMatchObject({
      id: 'PINNED_VERSION_INVALID',
    });
    expect(applyStoredOverrides).not.toHaveBeenCalled();
  });
});
