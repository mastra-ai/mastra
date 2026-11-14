/**
 * Recovering a durable agent run that crashed while an approved tool call ran.
 *
 * The model asks for three approval-gated tool calls in one step. The first is approved through
 * the same agent instance that suspended the run, and the process crashes while it runs. The
 * recovered run must run only that call again: the other two still wait for their own approval.
 */

import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { DurableStepIds } from '../constants';
import type { Gate } from './restart-harness';
import { createGate, createRestartScenario } from './restart-harness';

let llm: LLMock;
const gates: Gate[] = [];
const scenarios: { stop(): Promise<void> }[] = [];

beforeAll(async () => {
  llm = new LLMock({ port: 0 });
  await llm.start();
  llm.on(
    { endpoint: 'chat', hasToolResult: false },
    { toolCalls: [0, 1, 2].map(index => ({ id: `call_${index}`, name: 'charge', arguments: { index } })) },
  );
  llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'all charged' });
});

afterAll(async () => {
  await llm.stop();
});

afterEach(async () => {
  for (const gate of gates.splice(0)) gate.release();
  for (const scenario of scenarios.splice(0)) await scenario.stop();
});

describe('durable agent: restart while an approved tool call runs', () => {
  it('runs only the approved tool call, not the calls still waiting for approval', async () => {
    const runId = 'approval-restart';
    const hold = createGate();
    gates.push(hold);
    const charges: { generation: number; index: number }[] = [];
    const scenario = createRestartScenario({
      kind: 'durable',
      runId,
      build: ({ core, generation }) =>
        new core.Agent({
          id: 'approval-agent',
          name: 'approval-agent',
          instructions: 'Charge every card.',
          model: createOpenAI({ apiKey: 'test-key', baseURL: `${llm.url}/v1` }).chat('gpt-4o-mini'),
          tools: {
            charge: core.createTool({
              id: 'charge',
              description: 'Charges a card',
              inputSchema: z.object({ index: z.number() }),
              requireApproval: true,
              execute: async ({ index }) => {
                charges.push({ generation, index });
                if (generation === 1) await hold.wait();
                return { charged: index };
              },
            }),
          },
        }),
    });
    scenarios.push(scenario);

    let approvedId: string | undefined;
    const original = await scenario.start(async ({ agent }) => {
      const first = await agent.stream('Charge the cards', { runId });
      for await (const chunk of first.fullStream) {
        if (chunk.type === 'tool-call-approval') {
          approvedId = chunk.payload.toolCallId;
          break;
        }
      }
      // Approved through the instance that suspended the run.
      return agent.approveToolCall({ runId, toolCallId: approvedId });
    });
    await hold.reached;
    expect(approvedId).toBe('call_0');
    expect(charges).toEqual([{ generation: 1, index: 0 }]);

    const recovered = await scenario.restart(await original.checkpoint(), { closeOnSuspend: true });

    expect(recovered.streamErrors).toEqual([]);
    expect(charges.filter(c => c.generation === 2)).toEqual([{ generation: 2, index: 0 }]);
    // The next call asks for its own approval.
    expect(recovered.chunkTypes).toContain('tool-call-approval');
  }, 30_000);
});

/** A sub-agent that calls its approval-gated tool once, then answers. */
function subAgentModel(label: string) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const done = JSON.stringify(prompt).includes(`${label} done`);
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream<any>([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `${label}-${done ? 1 : 0}`, modelId: 'mock-model', timestamp: new Date(0) },
          ...(done
            ? [
                { type: 'text-start', id: `${label}-text` },
                { type: 'text-delta', id: `${label}-text`, delta: `${label} finished.` },
                { type: 'text-end', id: `${label}-text` },
              ]
            : [
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: `inner-${label}`,
                  toolName: 'gatedTool',
                  input: JSON.stringify({ query: label }),
                  providerExecuted: false,
                },
              ]),
          {
            type: 'finish',
            finishReason: done ? 'stop' : 'tool-calls',
            usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          },
        ]),
      };
    },
  });
}

/** A supervisor that delegates to both sub-agents in one step, then answers. */
function supervisorModel() {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const text = JSON.stringify(prompt);
      const done = text.includes('alpha finished') && text.includes('beta finished');
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream<any>([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `sup-${done ? 1 : 0}`, modelId: 'mock-model', timestamp: new Date(0) },
          ...(done
            ? [
                { type: 'text-start', id: 'sup-text' },
                { type: 'text-delta', id: 'sup-text', delta: 'Both delegations complete.' },
                { type: 'text-end', id: 'sup-text' },
              ]
            : ['Alpha', 'Beta'].map(name => ({
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: `sup-tc-${name[0]}`,
                toolName: `agent-sub${name}`,
                input: JSON.stringify({ prompt: `do ${name.toLowerCase()}` }),
                providerExecuted: false,
              }))),
          {
            type: 'finish',
            finishReason: done ? 'stop' : 'tool-calls',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      };
    },
  });
}

describe('durable agent: restart while an approved delegation is being resumed', () => {
  // Delegations to sub-agents run concurrently, so both suspend at once when each sub-agent's tool
  // needs approval. The approval of one goes through the instance that suspended the run, and the
  // process crashes before the loop's iteration workflow stores its resumed tool calls.
  const crashPoints = [
    {
      point: 'before the iteration workflow claims its resume',
      hold: {
        when: (snapshot: any) =>
          snapshot.context?.[DurableStepIds.AGENTIC_EXECUTION]?.status === 'running' &&
          snapshot.context[DurableStepIds.AGENTIC_EXECUTION].resumePayload !== undefined,
      },
    },
    {
      point: 'after the iteration workflow claims its resume, before its tool calls are stored',
      hold: {
        workflowName: DurableStepIds.AGENTIC_EXECUTION,
        when: (snapshot: any) =>
          snapshot.status === 'running' && snapshot.context?.[DurableStepIds.TOOL_CALL]?.status === 'suspended',
      },
    },
  ];

  /** Both delegations suspended, `sup-tc-A` approved, and a copy of the rows at the crash. */
  async function crashWhileApproving(hold: (typeof crashPoints)[number]['hold']) {
    const runId = 'delegation-approval-restart';
    const memory = { thread: 'delegation-thread', resource: 'delegation-resource' };
    const executions: { generation: number; query: string }[] = [];
    // Memory keeps the pending approvals; both graphs use one store for it.
    let memoryStore: any;
    const scenario = createRestartScenario({
      kind: 'durable',
      runId,
      hold,
      // A sub-agent's snapshot holds a function, which the harness can't copy and which a
      // persistent store drops when it serializes the row.
      storageMode: 'serializing',
      build: ({ core, generation }) => {
        const gatedTool = () =>
          core.createTool({
            id: 'gatedTool',
            description: 'Approval-gated tool',
            inputSchema: z.object({ query: z.string() }),
            requireApproval: true,
            execute: async ({ query }: { query: string }) => {
              executions.push({ generation, query });
              return { result: `${query} done` };
            },
          });
        const subAgent = (name: string) =>
          new core.Agent({
            id: `sub${name}`,
            name: `sub${name}`,
            description: `Does ${name.toLowerCase()}`,
            instructions: 'Use your tool.',
            model: subAgentModel(name.toLowerCase()) as any,
            tools: { gatedTool: gatedTool() },
          });
        return new core.Agent({
          id: 'supervisor',
          name: 'Supervisor',
          instructions: 'Delegate to both sub-agents.',
          model: supervisorModel() as any,
          agents: { subAlpha: subAgent('Alpha'), subBeta: subAgent('Beta') },
          memory: new core.MockMemory({ storage: (memoryStore ??= new core.InMemoryStore()) }),
        });
      },
    });
    scenarios.push(scenario);

    const original = await scenario.start(async ({ agent, workflows }) => {
      const first = await agent.stream('Do alpha and beta', { runId, memory, maxSteps: 5 });
      const asked = new Set<string>();
      for await (const chunk of first.fullStream) {
        if (chunk.type === 'tool-call-approval') asked.add(chunk.payload.toolCallId);
        if (asked.size === 2) break;
      }
      expect([...asked].sort()).toEqual(['sup-tc-A', 'sup-tc-B']);
      await vi.waitFor(async () => {
        const row = await workflows.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP });
        expect(row?.snapshot?.status).toBe('suspended');
      });
      // Approved through the instance that suspended the run.
      return agent.approveToolCall({ runId, toolCallId: 'sup-tc-A', memory });
    });
    await original.held;
    const checkpoint = await original.checkpoint();
    expect(executions).toEqual([]);
    return { scenario, checkpoint, executions, runId, memory };
  }

  const approve = async (agent: any, runId: string, toolCallId: string, memory: object) => {
    const resumed = await agent.approveToolCall({ runId, toolCallId, memory, closeOnSuspend: true });
    let text = '';
    for await (const chunk of resumed.fullStream) {
      if (chunk.type === 'text-delta') text += chunk.payload.text;
    }
    return text;
  };

  it.each(crashPoints)(
    'runs only the approved delegation after a crash $point',
    async ({ hold }) => {
      const { scenario, checkpoint, executions, runId, memory } = await crashWhileApproving(hold);

      const recovered = await scenario.restart(checkpoint, { closeOnSuspend: true });

      expect(recovered.streamErrors).toEqual([]);
      expect(executions).toEqual([{ generation: 2, query: 'alpha' }]);

      // Beta's own approval is still pending, and still works.
      expect(await approve(recovered.graph.agent, runId, 'sup-tc-B', memory)).toBe('Both delegations complete.');
      expect(executions).toEqual([
        { generation: 2, query: 'alpha' },
        { generation: 2, query: 'beta' },
      ]);
    },
    60_000,
  );

  it.each(crashPoints)(
    'runs no delegation when the stored resume recorded no target, after a crash $point',
    async ({ hold }) => {
      // Runs stored before the target was recorded carry the approval but not which call it is for.
      const { scenario, checkpoint, executions, runId, memory } = await crashWhileApproving(hold);
      const loop = checkpoint.rows.find(row => row.workflowName === DurableStepIds.AGENTIC_LOOP)!;
      const record = loop.snapshot.context[DurableStepIds.AGENTIC_EXECUTION] as any;
      expect(record.metadata.nestedResumeTarget).toEqual({ steps: [], label: 'sup-tc-A' });
      delete record.metadata.nestedResumeTarget;

      const recovered = await scenario.restart(checkpoint, { closeOnSuspend: true });

      expect(recovered.streamErrors).toEqual([]);
      expect(executions).toEqual([]);

      // Both approvals are still pending: approving each again runs it.
      await approve(recovered.graph.agent, runId, 'sup-tc-A', memory);
      expect(executions).toEqual([{ generation: 2, query: 'alpha' }]);
      expect(await approve(recovered.graph.agent, runId, 'sup-tc-B', memory)).toBe('Both delegations complete.');
      expect(executions).toEqual([
        { generation: 2, query: 'alpha' },
        { generation: 2, query: 'beta' },
      ]);
    },
    60_000,
  );
});
