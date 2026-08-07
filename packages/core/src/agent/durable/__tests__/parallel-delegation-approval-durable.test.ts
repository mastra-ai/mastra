/**
 * Durable parallel sub-agent delegation approvals.
 *
 * A durable supervisor delegates to two sub-agents in parallel (one tool-call
 * turn with two tool calls) and each sub-agent's tool requires approval.
 * Matching the default engine (#19450/#19645), the durable engine must:
 *  1. surface approval requests for both delegations,
 *  2. persist BOTH approvals in `pendingToolApprovals` with the outer runId
 *     and each delegation's own inner `delegatedRunId`,
 *  3. report the suspended run with both tool calls via `listSuspendedRuns()`,
 *  4. resume the approvals in any order, executing each gated tool exactly
 *     once and completing the run.
 *
 * Regressions covered:
 *  - The second suspension's metadata write was silently lost: the first
 *    suspension's pre-suspend flush drained the response messages, so the
 *    sibling's `addToolMetadata` found no assistant message and dropped the
 *    entry.
 *  - `listSuspendedRuns()` only queried the regular `agentic-loop` workflow
 *    name, so suspended durable runs (which persist under
 *    `durable-agentic-loop`) were never discoverable.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';

function makeSubAgentModel(label: string, resultToken: string) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const hasToolResult = JSON.stringify(prompt).includes(resultToken);
      if (!hasToolResult) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream<any>([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: `${label}-0`, modelId: 'mock-model', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: `inner-${label}`,
              toolName: 'gatedTool',
              input: `{"query":"${label}"}`,
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
            },
          ]),
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream<any>([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `${label}-1`, modelId: 'mock-model', timestamp: new Date(0) },
          { type: 'text-start', id: `${label}-text` },
          { type: 'text-delta', id: `${label}-text`, delta: `${label} done.` },
          { type: 'text-end', id: `${label}-text` },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 } },
        ]),
      };
    },
  });
}

/** Supervisor: one turn with TWO parallel delegations, then the final answer. */
function makeSupervisorModel() {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const text = JSON.stringify(prompt);
      const hasBoth = text.includes('alpha done') && text.includes('beta done');
      if (!hasBoth) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream<any>([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'sup-0', modelId: 'mock-model', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: 'sup-tc-A',
              toolName: 'agent-subAlpha',
              input: JSON.stringify({ prompt: 'do alpha' }),
              providerExecuted: false,
            },
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: 'sup-tc-B',
              toolName: 'agent-subBeta',
              input: JSON.stringify({ prompt: 'do beta' }),
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
        stream: convertArrayToReadableStream<any>([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'sup-1', modelId: 'mock-model', timestamp: new Date(0) },
          { type: 'text-start', id: 'sup-text' },
          { type: 'text-delta', id: 'sup-text', delta: 'Both delegations complete.' },
          { type: 'text-end', id: 'sup-text' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
        ]),
      };
    },
  });
}

/**
 * Drain a stream until `stopWhen` returns true or the stream ends. Durable
 * streams intentionally stay open while the run is suspended (so a later
 * resume can keep streaming), so mid-flow legs stop at a condition instead of
 * waiting for closure. Returns collected chunk types/approvals/text.
 */
async function drainUntil(stream: AsyncIterable<any>, stopWhen: (state: { types: string[] }) => boolean, ms = 15000) {
  const types: string[] = [];
  const approvals: any[] = [];
  let text = '';
  let timedOut = false;
  const iterator = stream[Symbol.asyncIterator]();
  const deadline = Date.now() + ms;
  while (true) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      timedOut = true;
      break;
    }
    const next = await Promise.race([
      iterator.next(),
      new Promise<'timeout'>(res => setTimeout(() => res('timeout'), remaining)),
    ]);
    if (next === 'timeout') {
      timedOut = true;
      break;
    }
    if (next.done) break;
    const chunk = next.value;
    types.push(chunk.type);
    if (chunk.type === 'tool-call-approval') approvals.push(chunk.payload);
    if (chunk.type === 'text-delta') text += chunk.payload?.text ?? '';
    if (stopWhen({ types })) break;
  }
  return { types, approvals, text, timedOut };
}

describe('durable parallel delegation approvals', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    globalRunRegistry.clear();
    await pubsub.close();
  });

  const setup = () => {
    const storage = new InMemoryStore();
    const mockMemory = new MockMemory();
    const executions: string[] = [];

    const buildGatedTool = () =>
      createTool({
        id: 'gatedTool',
        description: 'Approval-gated tool',
        inputSchema: z.object({ query: z.string() }),
        requireApproval: true,
        execute: async (input: { query: string }) => {
          executions.push(input.query);
          return { result: `${input.query} done` };
        },
      });

    const subAlpha = new Agent({
      id: 'subAlpha',
      name: 'subAlpha',
      description: 'Does alpha',
      instructions: 'Use your tool.',
      model: makeSubAgentModel('alpha', 'alpha done') as LanguageModelV2,
      tools: { gatedTool: buildGatedTool() },
    });
    const subBeta = new Agent({
      id: 'subBeta',
      name: 'subBeta',
      description: 'Does beta',
      instructions: 'Use your tool.',
      model: makeSubAgentModel('beta', 'beta done') as LanguageModelV2,
      tools: { gatedTool: buildGatedTool() },
    });
    const supervisor = new Agent({
      id: 'supervisor',
      name: 'Supervisor',
      instructions: 'Delegate to both sub-agents.',
      model: makeSupervisorModel() as LanguageModelV2,
      agents: { subAlpha, subBeta },
      memory: mockMemory,
    });

    const durableAgent = createDurableAgent({ agent: supervisor, pubsub });
    new Mastra({ agents: { durableAgent }, storage, logger: false });
    return { storage, mockMemory, executions, durableAgent };
  };

  const runToBothApprovals = async (
    durableAgent: ReturnType<typeof setup>['durableAgent'],
    memory: { thread: string; resource: string },
    storage: InMemoryStore,
  ) => {
    const result = await durableAgent.stream('Do alpha and beta', { memory, maxSteps: 5 });
    const leg1 = await drainUntil(
      result.fullStream,
      ({ types }) => types.filter(t => t === 'tool-call-approval').length >= 2,
    );
    expect(
      leg1.approvals.map(a => a?.toolCallId).sort(),
      `both delegations should surface approval requests; chunks: ${leg1.types.join(', ')}`,
    ).toEqual(['sup-tc-A', 'sup-tc-B']);

    const workflows = (await storage.getStore('workflows'))!;
    await vi.waitFor(async () => {
      const persisted = await workflows.getWorkflowRunById({
        runId: result.runId,
        workflowName: DurableStepIds.AGENTIC_LOOP,
      });
      const snapshot = typeof persisted?.snapshot === 'string' ? JSON.parse(persisted.snapshot) : persisted?.snapshot;
      expect(snapshot?.status).toBe('suspended');
    });
    return result.runId;
  };

  const getApprovalEntries = async (mockMemory: MockMemory, memory: { thread: string; resource: string }) => {
    return vi.waitFor(async () => {
      const { messages } = await mockMemory.recall({ threadId: memory.thread, resourceId: memory.resource });
      const withApproval = [...messages]
        .reverse()
        .find(
          (m: any) =>
            m.role === 'assistant' && Object.keys((m.content as any)?.metadata?.pendingToolApprovals ?? {}).length >= 2,
        );
      const approvals = (withApproval as any)?.content?.metadata?.pendingToolApprovals as
        | Record<string, any>
        | undefined;
      expect(approvals).toBeDefined();
      return approvals!;
    });
  };

  const approveAndDrainMiddleLeg = async (
    durableAgent: ReturnType<typeof setup>['durableAgent'],
    runId: string,
    toolCallId: string,
    memory: { thread: string; resource: string },
  ) => {
    // The run re-suspends afterwards (the sibling is still parked), so the
    // stream stays open by design — stop at the delegation's tool-result.
    const resumed = await durableAgent.approveToolCall({ runId, toolCallId, memory });
    const leg = await drainUntil(resumed.fullStream, ({ types }) => types.includes('tool-result'));
    expect(leg.timedOut, `approving ${toolCallId} should produce a tool-result; got: ${leg.types.join(', ')}`).toBe(
      false,
    );
    expect(leg.types, `no errors after approving ${toolCallId}`).not.toContain('error');
    expect(leg.types, `no tool errors after approving ${toolCallId}`).not.toContain('tool-error');
  };

  const approveAndDrainFinalLeg = async (
    durableAgent: ReturnType<typeof setup>['durableAgent'],
    runId: string,
    toolCallId: string,
    memory: { thread: string; resource: string },
  ) => {
    // The last approval completes the run, so the stream closes on finish.
    const resumed = await durableAgent.approveToolCall({ runId, toolCallId, memory });
    const leg = await drainUntil(resumed.fullStream, () => false);
    expect(leg.timedOut, `final approval should complete the run; got: ${leg.types.join(', ')}`).toBe(false);
    expect(leg.types, `no errors after approving ${toolCallId}`).not.toContain('error');
    expect(leg.types, `no tool errors after approving ${toolCallId}`).not.toContain('tool-error');
    expect(leg.types).toContain('finish');
    expect(leg.text).toBe('Both delegations complete.');
  };

  const assertLeg1State = async (
    runId: string,
    mockMemory: MockMemory,
    durableAgent: ReturnType<typeof setup>['durableAgent'],
    memory: { thread: string; resource: string },
    executions: string[],
  ) => {
    // Both approvals persist with the outer runId and their own inner run.
    const entries = await getApprovalEntries(mockMemory, memory);
    expect(Object.keys(entries).sort()).toEqual(['sup-tc-A', 'sup-tc-B']);
    for (const toolCallId of ['sup-tc-A', 'sup-tc-B']) {
      expect(entries[toolCallId]!.runId).toBe(runId);
      expect(entries[toolCallId]!.delegatedRunId).toBeDefined();
      expect(entries[toolCallId]!.delegatedRunId).not.toBe(runId);
    }
    expect(entries['sup-tc-A']!.delegatedRunId).not.toBe(entries['sup-tc-B']!.delegatedRunId);

    // The suspended durable run is discoverable with both tool calls.
    const discovered = await durableAgent.listSuspendedRuns({
      threadId: memory.thread,
      resourceId: memory.resource,
    });
    expect(discovered.total).toBe(1);
    expect(discovered.runs[0]!.runId).toBe(runId);
    expect(discovered.runs[0]!.toolCalls.map(tc => tc.toolCallId).sort()).toEqual(['sup-tc-A', 'sup-tc-B']);

    // Nothing has executed before approval.
    expect(executions).toEqual([]);
  };

  it('persists, discovers, and resumes both approvals in order (A then B)', async () => {
    const { storage, mockMemory, executions, durableAgent } = setup();
    const memory = { thread: 'parallel-a-first-thread', resource: 'parallel-a-first-resource' };

    const runId = await runToBothApprovals(durableAgent, memory, storage);
    await assertLeg1State(runId, mockMemory, durableAgent, memory, executions);

    await approveAndDrainMiddleLeg(durableAgent, runId, 'sup-tc-A', memory);
    await vi.waitFor(() => expect(executions).toContain('alpha'));

    await approveAndDrainFinalLeg(durableAgent, runId, 'sup-tc-B', memory);
    expect(executions.sort()).toEqual(['alpha', 'beta']);
  }, 60000);

  it('resumes the approvals out of order (B before A)', async () => {
    const { storage, mockMemory, executions, durableAgent } = setup();
    const memory = { thread: 'parallel-b-first-thread', resource: 'parallel-b-first-resource' };

    const runId = await runToBothApprovals(durableAgent, memory, storage);
    await assertLeg1State(runId, mockMemory, durableAgent, memory, executions);

    await approveAndDrainMiddleLeg(durableAgent, runId, 'sup-tc-B', memory);
    await vi.waitFor(() => expect(executions).toContain('beta'));

    await approveAndDrainFinalLeg(durableAgent, runId, 'sup-tc-A', memory);
    expect(executions.sort()).toEqual(['alpha', 'beta']);
  }, 60000);
});
