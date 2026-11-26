/**
 * Concurrent resumes of the same suspended agentic-loop run (double clicks, client
 * retries, two tabs) must execute the suspended tool exactly once. One caller claims
 * the run; the others fail with AGENT_RESUME_ALREADY_CLAIMED. See #26133.
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent, AGENT_RESUME_CLAIM_STALE_MS } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

function createMockModel() {
  let callCount = 0;
  const finish = (finishReason: 'tool-calls' | 'stop') => ({
    type: 'finish' as const,
    finishReason,
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
  });
  const stream = (chunks: any[]) => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
    stream: convertArrayToReadableStream([
      { type: 'stream-start', warnings: [] },
      { type: 'response-metadata', id: `id-${callCount}`, modelId: 'mock-model-id', timestamp: new Date(0) },
      ...chunks,
    ]),
  });
  const doCall = async () => {
    callCount++;
    if (callCount === 1) {
      return stream([
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'archiveItem',
          input: '{"id":"item-1"}',
          providerExecuted: false,
        },
        finish('tool-calls'),
      ]);
    }
    return stream([
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', delta: 'Archived' },
      { type: 'text-end', id: 'text-1' },
      finish('stop'),
    ]);
  };
  return new MockLanguageModelV2({
    doStream: doCall,
    doGenerate: async () => {
      callCount++;
      const usage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };
      const rawCall = { rawPrompt: null, rawSettings: {} };
      if (callCount === 1) {
        return {
          rawCall,
          warnings: [],
          finishReason: 'tool-calls',
          usage,
          content: [{ type: 'tool-call', toolCallId: 'call-1', toolName: 'archiveItem', input: '{"id":"item-1"}' }],
        };
      }
      return { rawCall, warnings: [], finishReason: 'stop', usage, content: [{ type: 'text', text: 'Archived' }] };
    },
  });
}

async function setup({ atomicStore = true }: { atomicStore?: boolean } = {}) {
  const execute = vi.fn(async ({ id }: { id: string }) => ({ archived: id }));
  const agent = new Agent({
    id: 'archive-agent',
    name: 'Archive Agent',
    instructions: 'You archive items.',
    model: createMockModel(),
    tools: {
      archiveItem: createTool({
        id: 'archive_item',
        description: 'Archives an item',
        inputSchema: z.object({ id: z.string() }),
        requireApproval: true,
        execute,
      }),
    },
  });
  const storage = new InMemoryStore();
  const mastra = new Mastra({ agents: { agent }, logger: false, storage });
  const workflowsStore = (await mastra.getStorage()!.getStore('workflows'))!;
  if (!atomicStore) {
    vi.spyOn(workflowsStore, 'supportsConcurrentUpdates').mockReturnValue(false);
  }

  const stream = await agent.stream('Archive item-1', { requireToolApproval: true });
  let toolCallId = '';
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'tool-call-approval') toolCallId = chunk.payload.toolCallId;
  }
  expect(toolCallId).toBeTruthy();

  return { agent, execute, runId: stream.runId, toolCallId, workflowsStore };
}

async function drain(output: { fullStream: AsyncIterable<unknown> }) {
  for await (const _chunk of output.fullStream) {
    // consume
  }
}

function expectOneWinner(results: PromiseSettledResult<unknown>[]) {
  const fulfilled = results.filter(r => r.status === 'fulfilled');
  const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  expect(fulfilled).toHaveLength(1);
  expect(rejected).toHaveLength(results.length - 1);
  for (const r of rejected) {
    expect(r.reason).toMatchObject({ id: 'AGENT_RESUME_ALREADY_CLAIMED' });
  }
  return (fulfilled[0] as PromiseFulfilledResult<any>).value;
}

describe('concurrent resumes of a suspended agent run', () => {
  it('runs the tool once when approveToolCall is called twice concurrently', async () => {
    const { agent, execute, runId, toolCallId } = await setup();

    const results = await Promise.allSettled([
      agent.approveToolCall({ runId, toolCallId }),
      agent.approveToolCall({ runId, toolCallId }),
    ]);
    await drain(expectOneWinner(results));

    expect(execute).toHaveBeenCalledTimes(1);
  }, 30000);

  it('lets only one of a concurrent approve and decline win', async () => {
    const { agent, execute, runId, toolCallId } = await setup();

    const results = await Promise.allSettled([
      agent.approveToolCall({ runId, toolCallId }),
      agent.declineToolCall({ runId, toolCallId }),
    ]);
    await drain(expectOneWinner(results));

    expect(execute.mock.calls.length).toBeLessThanOrEqual(1);
  }, 30000);

  it('runs the tool once when approveToolCallGenerate is called twice concurrently', async () => {
    const { agent, execute, runId, toolCallId } = await setup();

    const results = await Promise.allSettled([
      agent.approveToolCallGenerate({ runId, toolCallId }),
      agent.approveToolCallGenerate({ runId, toolCallId }),
    ]);
    expectOneWinner(results);

    expect(execute).toHaveBeenCalledTimes(1);
  }, 30000);

  it('keeps sequential second approvals failing with AGENT_RESUME_NO_SNAPSHOT_FOUND', async () => {
    const { agent, execute, runId, toolCallId } = await setup();

    await drain(await agent.approveToolCall({ runId, toolCallId }));
    await expect(agent.approveToolCall({ runId, toolCallId })).rejects.toMatchObject({
      id: 'AGENT_RESUME_NO_SNAPSHOT_FOUND',
    });

    expect(execute).toHaveBeenCalledTimes(1);
  }, 30000);

  it('releases the claim when the resume fails before the run starts', async () => {
    const { agent, execute, runId, toolCallId, workflowsStore } = await setup();

    vi.spyOn(agent, 'getLLM').mockRejectedValueOnce(new Error('model resolution failed'));
    await expect(agent.approveToolCall({ runId, toolCallId })).rejects.toThrow('model resolution failed');

    const snapshot = await workflowsStore.loadWorkflowSnapshot({ workflowName: 'agentic-loop', runId });
    expect(snapshot?.status).toBe('suspended');

    await drain(await agent.approveToolCall({ runId, toolCallId }));
    expect(execute).toHaveBeenCalledTimes(1);
  }, 30000);

  it('runs the tool once on stores without atomic updates within one process', async () => {
    const { agent, execute, runId, toolCallId } = await setup({ atomicStore: false });
    const warn = vi.spyOn(agent.__getLogger(), 'warn');

    const results = await Promise.allSettled([
      agent.approveToolCall({ runId, toolCallId }),
      agent.approveToolCall({ runId, toolCallId }),
    ]);
    await drain(expectOneWinner(results));

    expect(execute).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('only de-duplicated within this process'));
  }, 30000);

  // A process that dies between claiming and starting the resume leaves the claim behind.
  async function strandClaim(workflowsStore: any, runId: string, ageMs: number) {
    const stranded = await workflowsStore.updateWorkflowState({
      workflowName: 'agentic-loop',
      runId,
      opts: { status: 'pending', expectedStatus: 'suspended', resumeClaimedAt: Date.now() - ageMs },
    });
    expect(stranded?.status).toBe('pending');
  }

  it('lets a later approval take over a claim abandoned before the resume started', async () => {
    const { agent, execute, runId, toolCallId, workflowsStore } = await setup();
    await strandClaim(workflowsStore, runId, AGENT_RESUME_CLAIM_STALE_MS + 1_000);

    await drain(await agent.approveToolCall({ runId, toolCallId }));

    expect(execute).toHaveBeenCalledTimes(1);
  }, 30000);

  it('rejects an approval while a recent claim may still be starting', async () => {
    const { agent, execute, runId, toolCallId, workflowsStore } = await setup();
    await strandClaim(workflowsStore, runId, 0);

    await expect(agent.approveToolCall({ runId, toolCallId })).rejects.toMatchObject({
      id: 'AGENT_RESUME_ALREADY_CLAIMED',
    });
    expect(execute).not.toHaveBeenCalled();
  }, 30000);
});
