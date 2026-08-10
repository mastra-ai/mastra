/**
 * Agent-loop snapshot size (issue #18647).
 *
 * Agent-loop snapshots are pure resume artifacts: users never query them
 * (tracing owns observability, memory owns the conversation) — they exist only
 * so `resumeStream()` can restore a suspended run. Historically each HITL
 * suspension re-persisted the full conversation several times over (step
 * payload/prevOutput message arrays, AI SDK `output.steps`, and a stale
 * `__streamState` retained on completed steps after every resume), so snapshot
 * size scaled with thread length × number of historical suspensions and hit
 * storage row limits (5MB+).
 *
 * These tests pin the fixed behavior:
 *  1. snapshot size must not grow with the number of historical suspensions
 *  2. a pruned snapshot must still resume correctly (strip-and-resume)
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import type { WorkflowRunState } from '../../workflows';
import { Agent } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

const executedCalls: string[] = [];

function createApprovalTool() {
  return createTool({
    id: 'Find user tool',
    description: 'Returns the name and email of a user',
    inputSchema: z.object({ name: z.string() }),
    requireApproval: true,
    execute: async (input: { name: string }) => {
      executedCalls.push(input.name);
      return { name: input.name, email: `${input.name}@mail.com` };
    },
  });
}

/**
 * Mock model that requests two sequential approval-gated tool calls before
 * finishing, producing two separate suspensions in one run:
 *   call 1 → tool-call #1 (suspend) → approve →
 *   call 2 → tool-call #2 (suspend) → approve →
 *   call 3 → final text
 */
function createTwoToolCallModel() {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount <= 2) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: `id-${callCount}`, modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: `call-${callCount}`,
              toolName: 'findUserTool',
              input: `{"name":"User ${callCount}"}`,
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
          { type: 'response-metadata', id: 'id-final', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'All users found' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      };
    },
  });
}

/**
 * Produces one large completed tool result, then parks on a separate approval.
 * This mirrors #19396: the approval payload is tiny, but the previously completed
 * result is carried through the nested/foreach workflow state persisted at suspend.
 */
function createLargeOutputThenApprovalModel() {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      const toolCall =
        callCount === 1
          ? { toolCallId: 'large-output-call', toolName: 'largeOutputTool', input: '{}' }
          : { toolCallId: 'approval-call', toolName: 'approvalTool', input: '{"operation":"continue"}' };

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          {
            type: 'response-metadata',
            id: `large-output-${callCount}`,
            modelId: 'mock-model-id',
            timestamp: new Date(0),
          },
          {
            type: 'tool-call',
            ...toolCall,
            providerExecuted: false,
          },
          {
            type: 'finish',
            finishReason: 'tool-calls',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      };
    },
  });
}

function createSingleApprovalModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'approval-only', modelId: 'mock-model-id', timestamp: new Date(0) },
        {
          type: 'tool-call',
          toolCallId: 'denied-call',
          toolName: 'approvalTool',
          input: '{"operation":"delete"}',
          providerExecuted: false,
        },
        { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

function createFinalTextModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'final', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

/** A long seeded conversation so snapshot bloat is measurable. */
function buildLongThread(messageCount: number, filler: string) {
  const messages: Array<{ role: 'user'; content: string } | { role: 'assistant'; content: string }> = [];
  for (let i = 0; i < messageCount; i++) {
    messages.push({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `message ${i}: ${filler}`,
    });
  }
  messages.push({ role: 'user', content: 'Find the users I asked about' });
  return messages;
}

async function collectApproval(stream: { fullStream: AsyncIterable<any> }) {
  let toolCallId = '';
  let text = '';
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'tool-call-approval') {
      toolCallId = chunk.payload.toolCallId;
    }
    if (chunk.type === 'text-delta') {
      text += chunk.payload.text;
    }
  }
  return { toolCallId, text };
}

function snapshotRows(runs: { workflowName: string; snapshot: string | WorkflowRunState }[]) {
  return runs.filter(r => typeof r.snapshot !== 'string') as { workflowName: string; snapshot: WorkflowRunState }[];
}

function totalSnapshotSize(runs: { workflowName: string; snapshot: string | WorkflowRunState }[]) {
  return snapshotRows(runs).reduce((sum, r) => sum + JSON.stringify(r.snapshot).length, 0);
}

function countObjectKey(value: unknown, expectedKey: string): number {
  if (Array.isArray(value)) {
    return value.reduce((count, entry) => count + countObjectKey(entry, expectedKey), 0);
  }
  if (!value || typeof value !== 'object') return 0;

  return Object.entries(value).reduce(
    (count, [key, entry]) => count + (key === expectedKey ? 1 : 0) + countObjectKey(entry, expectedKey),
    0,
  );
}

/** Count occurrences of a marker string across all persisted snapshots. */
function countMarker(runs: { workflowName: string; snapshot: string | WorkflowRunState }[], marker: string) {
  return snapshotRows(runs).reduce((sum, r) => {
    const s = JSON.stringify(r.snapshot);
    let count = 0;
    let idx = s.indexOf(marker);
    while (idx !== -1) {
      count++;
      idx = s.indexOf(marker, idx + marker.length);
    }
    return sum + count;
  }, 0);
}

describe('agent-loop snapshot size', () => {
  it('characterizes large completed output duplicated around a small pending approval', async () => {
    const largeOutputMarker = 'large-result-marker';
    const largeOutput = `${largeOutputMarker}:${'z'.repeat(200_000)}`;
    const storage = new InMemoryStore();

    const largeOutputTool = createTool({
      id: 'large-output-tool',
      description: 'Returns a realistically large result before approval is requested',
      inputSchema: z.object({}),
      execute: async () => ({ content: largeOutput }),
    });
    const approvalTool = createTool({
      id: 'approval-tool',
      description: 'A small operation that requires approval',
      inputSchema: z.object({ operation: z.string() }),
      requireApproval: true,
      execute: async ({ operation }) => ({ operation, approved: true }),
    });
    const agent = new Agent({
      id: 'large-output-approval-agent',
      name: 'Large Output Approval Agent',
      instructions: 'Run the large-output tool, then request approval.',
      model: createLargeOutputThenApprovalModel(),
      tools: { largeOutputTool, approvalTool },
    });
    const mastra = new Mastra({ agents: { agent }, logger: false, storage });

    const stream = await agent.stream('Process the large result and ask before continuing.');
    const approval = await collectApproval(stream);
    expect(approval.toolCallId).toBe('approval-call');

    const workflowsStore = (await mastra.getStorage()!.getStore('workflows'))!;
    const runs = (await workflowsStore.listWorkflowRuns({})).runs;
    const snapshots = snapshotRows(runs);
    const serializedSize = totalSnapshotSize(runs);
    const largeOutputCopies = countMarker(runs, largeOutputMarker);
    const foreachOutputCopies = snapshots.reduce(
      (count, row) => count + countObjectKey(row.snapshot, 'foreachOutput'),
      0,
    );

    // Characterization only: current full-resume snapshots retain the completed
    // output in multiple nested/foreach locations even though the pending approval
    // itself is small. Phase 3 will define the minimal-checkpoint assertions.
    expect(snapshots.length).toBeGreaterThan(0);
    expect(foreachOutputCopies).toBeGreaterThan(0);
    expect(largeOutputCopies).toBeGreaterThan(1);
    expect(serializedSize).toBeGreaterThan(largeOutput.length * 2);
  }, 60000);

  it('persists compact versioned checkpoints when minimal approval persistence is selected', async () => {
    const largeOutputMarker = 'phase-4-large-output-marker';
    const largeOutput = `${largeOutputMarker}:${'z'.repeat(200_000)}`;
    const storage = new InMemoryStore();
    const approvedOperations: string[] = [];
    const largeOutputTool = createTool({
      id: 'large-output-tool',
      description: 'Returns a large completed result',
      inputSchema: z.object({}),
      execute: async () => ({ content: largeOutput }),
    });
    const approvalTool = createTool({
      id: 'approval-tool',
      description: 'A small operation that requires approval',
      inputSchema: z.object({ operation: z.string() }),
      requireApproval: true,
      execute: async ({ operation }) => {
        approvedOperations.push(operation);
        return { operation, approved: true };
      },
    });
    const agent = new Agent({
      id: 'minimal-approval-agent',
      name: 'Minimal Approval Agent',
      instructions: 'Run the large-output tool, then request approval.',
      model: createLargeOutputThenApprovalModel(),
      tools: { largeOutputTool, approvalTool },
    });
    const mastra = new Mastra({ agents: { agent }, logger: false, storage });

    const stream = await agent.stream('Process the large result and ask before continuing.', {
      approvalPersistence: 'minimal',
    });
    const approval = await collectApproval(stream);
    expect(approval.toolCallId).toBe('approval-call');

    const workflowsStore = (await mastra.getStorage()!.getStore('workflows'))!;
    const runs = (await workflowsStore.listWorkflowRuns({})).runs;
    const objectSnapshots = runs.filter(run => typeof run.snapshot !== 'string').map(run => run.snapshot as any);

    expect(objectSnapshots.length).toBeGreaterThan(0);
    expect(objectSnapshots.every(snapshot => snapshot.kind === 'agent-approval-checkpoint')).toBe(true);
    expect(objectSnapshots.every(snapshot => snapshot.version === 1)).toBe(true);
    const serialized = JSON.stringify(objectSnapshots);
    expect(serialized.split(largeOutputMarker).length - 1).toBeLessThanOrEqual(objectSnapshots.length);
    expect(serialized).not.toContain('foreachOutput');
    expect(serialized).not.toContain('bufferedSteps":[{');
    expect(serialized.length).toBeLessThan(largeOutput.length * 3);

    const finalTextModel = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-after-checkpoint', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Approved after checkpoint restart' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
        ]),
      }),
    });
    const agentAfterRestart = new Agent({
      id: 'minimal-approval-agent',
      name: 'Minimal Approval Agent',
      instructions: 'Continue after approval.',
      model: finalTextModel,
      tools: { largeOutputTool, approvalTool },
    });
    new Mastra({ agents: { agent: agentAfterRestart }, logger: false, storage });

    const resumed = await agentAfterRestart.approveToolCall({
      runId: stream.runId,
      toolCallId: approval.toolCallId,
    });
    const final = await collectApproval(resumed);

    expect({ text: final.text, approvedOperations }).toEqual({
      text: 'Approved after checkpoint restart',
      approvedOperations: ['continue'],
    });
    expect((await workflowsStore.listWorkflowRuns({})).runs).toHaveLength(0);
    await expect(
      agentAfterRestart.approveToolCall({ runId: stream.runId, toolCallId: approval.toolCallId }),
    ).rejects.toThrow('could not find a suspended run');
    expect(approvedOperations).toEqual(['continue']);
  }, 60000);

  it('persists a denial across a process boundary without executing the tool', async () => {
    const storage = new InMemoryStore();
    const executed: string[] = [];
    const approvalTool = createTool({
      id: 'approval-tool',
      description: 'A destructive operation that requires approval',
      inputSchema: z.object({ operation: z.string() }),
      requireApproval: true,
      execute: async ({ operation }) => {
        executed.push(operation);
        return { operation };
      },
    });
    const original = new Agent({
      id: 'minimal-denial-agent',
      name: 'Minimal Denial Agent',
      instructions: 'Ask before acting.',
      model: createSingleApprovalModel(),
      tools: { approvalTool },
    });
    new Mastra({ agents: { original }, logger: false, storage });
    const suspended = await original.stream('Delete the record.', { approvalPersistence: 'minimal' });
    const approval = await collectApproval(suspended);
    expect(approval.toolCallId).toBe('denied-call');

    const restarted = new Agent({
      id: 'minimal-denial-agent',
      name: 'Minimal Denial Agent',
      instructions: 'Report the denial.',
      model: createFinalTextModel('The operation was denied'),
      tools: { approvalTool },
    });
    const restartedMastra = new Mastra({ agents: { restarted }, logger: false, storage });
    const declined = await restarted.declineToolCall({ runId: suspended.runId, toolCallId: approval.toolCallId });
    const final = await collectApproval(declined);

    expect(final.text).toBe('The operation was denied');
    expect(executed).toEqual([]);
    const workflowsStore = (await restartedMastra.getStorage()!.getStore('workflows'))!;
    expect((await workflowsStore.listWorkflowRuns({})).runs).toHaveLength(0);
  }, 60000);

  it('snapshot size does not grow with the number of historical suspensions', async () => {
    executedCalls.length = 0;
    const agent = new Agent({
      id: 'size-agent',
      name: 'Size Agent',
      instructions: 'You find users.',
      model: createTwoToolCallModel(),
      tools: { findUserTool: createApprovalTool() },
    });

    const mastra = new Mastra({
      agents: { agent },
      logger: false,
      storage: new InMemoryStore(),
    });

    const workflowsStore = (await mastra.getStorage()!.getStore('workflows'))!;

    // ~100 messages × ~600 chars ≈ 60KB of raw conversation
    const filler = 'x'.repeat(600);
    const thread = buildLongThread(100, filler);
    const rawThreadSize = JSON.stringify(thread).length;

    const stream = await agent.stream(thread, { requireToolApproval: true });
    const first = await collectApproval(stream);
    expect(first.toolCallId).toBeTruthy();

    const runsAtFirstSuspension = (await workflowsStore.listWorkflowRuns({})).runs;
    const sizeAtFirstSuspension = totalSnapshotSize(runsAtFirstSuspension);
    // Exactly one serialized copy of the conversation may exist per suspended
    // step (`__streamState.messageList`) — not one per step payload/prevOutput
    // and not another in `context.input`.
    const fillerCopiesFirst = countMarker(runsAtFirstSuspension, `message 42: ${filler}`);

    const resume1 = await agent.approveToolCall({ runId: stream.runId, toolCallId: first.toolCallId });
    const second = await collectApproval(resume1);
    expect(second.toolCallId).toBeTruthy();
    expect(second.toolCallId).not.toBe(first.toolCallId);
    expect(executedCalls).toEqual(['User 1']);

    const runsAtSecondSuspension = (await workflowsStore.listWorkflowRuns({})).runs;
    const sizeAtSecondSuspension = totalSnapshotSize(runsAtSecondSuspension);
    const fillerCopiesSecond = countMarker(runsAtSecondSuspension, `message 42: ${filler}`);

    // The second suspension may not retain the first suspension's resume
    // state (stale `__streamState` on completed steps) nor otherwise re-copy
    // the conversation. Allow small growth (the tool call/result messages
    // appended between suspensions), but nothing proportional to a second
    // conversation copy.
    expect(fillerCopiesSecond).toBeLessThanOrEqual(fillerCopiesFirst);
    expect(sizeAtSecondSuspension).toBeLessThan(sizeAtFirstSuspension + rawThreadSize * 0.5);

    // And the snapshot must stay O(thread), not O(thread × suspensions). The
    // constant factor reflects the remaining live resume-state copies:
    // each `__streamState.messageList` encodes the conversation twice
    // (`content.content` + `content.parts[].text`), and a suspension is held
    // in the tool-call step's suspendPayload, its foreach aggregation entry,
    // and the parent loop row. Deduplicating those is a follow-up —
    // measured: ~7.4× vs ~33× unpruned.
    const ceiling = rawThreadSize * 9;
    expect(sizeAtFirstSuspension).toBeLessThan(ceiling);
    expect(sizeAtSecondSuspension).toBeLessThan(ceiling);

    // The run must still complete correctly after the final approval.
    const resume2 = await agent.approveToolCall({ runId: stream.runId, toolCallId: second.toolCallId });
    const final = await collectApproval(resume2);
    expect(final.text).toBe('All users found');
    expect(executedCalls).toEqual(['User 1', 'User 2']);

    // Terminal runs delete their snapshot rows entirely.
    expect((await workflowsStore.listWorkflowRuns({})).runs).toHaveLength(0);
  }, 60000);

  it('resumes from the persisted snapshot alone (simulated restart)', async () => {
    // After a restart, the persisted snapshot is the only source of resume
    // state — no live RunScope, no in-memory run registration. Whatever the
    // snapshot pruning keeps must be sufficient on its own.
    executedCalls.length = 0;
    const storage = new InMemoryStore();

    const agentBefore = new Agent({
      id: 'restart-agent',
      name: 'Restart Agent',
      instructions: 'You find users.',
      model: createTwoToolCallModel(),
      tools: { findUserTool: createApprovalTool() },
    });
    new Mastra({ agents: { agent: agentBefore }, logger: false, storage });

    const filler = 'y'.repeat(600);
    const thread = buildLongThread(50, filler);

    const stream = await agentBefore.stream(thread, { requireToolApproval: true });
    const first = await collectApproval(stream);
    expect(first.toolCallId).toBeTruthy();

    // "Restart": a fresh Mastra + agent instance over the same storage. The
    // fresh mock model returns final text on its first call, which is the
    // call the resumed loop makes after executing the approved tool.
    const finalTextModel = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-after-restart', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Resumed after restart' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
        ]),
      }),
    });

    const agentAfter = new Agent({
      id: 'restart-agent',
      name: 'Restart Agent',
      instructions: 'You find users.',
      model: finalTextModel,
      tools: { findUserTool: createApprovalTool() },
    });
    const mastraAfter = new Mastra({ agents: { agent: agentAfter }, logger: false, storage });

    const resumed = await agentAfter.approveToolCall({ runId: stream.runId, toolCallId: first.toolCallId });
    const final = await collectApproval(resumed);

    expect(executedCalls).toEqual(['User 1']);
    expect(final.text).toBe('Resumed after restart');

    const workflowsStore = (await mastraAfter.getStorage()!.getStore('workflows'))!;
    expect((await workflowsStore.listWorkflowRuns({})).runs).toHaveLength(0);
  }, 60000);
});
