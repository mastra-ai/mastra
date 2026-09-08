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
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

function createModel() {
  let callCount = 0;
  return new MockLanguageModelV2({
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
      throw new Error(`version ${versionId} not found`);
    }
    const fork = agent.__fork();
    fork.__setRawConfig({ ...(agent.toRawConfig() ?? {}), resolvedVersionId: versionId });
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

async function drain(stream: { fullStream: AsyncIterable<unknown> }) {
  for await (const _chunk of stream.fullStream) {
    // consume
  }
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

  it('falls back to the code-defined agent when the pinned version can no longer be resolved', async () => {
    // The pinned version is deleted while the run is suspended: the resume must still
    // complete rather than throwing at the approver.
    const { agent, publish, deleteVersion } = setup();
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_VERSIONS_KEY, { agents: { 'versioned-agent': { status: 'published' } } });

    const { runId, toolCallId } = await suspendOnApproval(agent, requestContext, 'thread-1');
    publish('v2');
    deleteVersion('v1');

    await expect(drain(await agent.approveToolCall({ runId, toolCallId }))).resolves.toBeUndefined();
  });
});
