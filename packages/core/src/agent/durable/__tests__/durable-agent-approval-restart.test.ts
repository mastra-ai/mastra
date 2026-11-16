/**
 * Recovering a durable agent run that crashed while an approval was being applied. The recovered
 * run must run only the approved tool call: every other call still waits for its own approval.
 */

import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { DurableStepIds } from '../constants';
import type { Checkpoint, Gate, HoldWrite } from './restart-harness';
import { createGate, createRestartScenario } from './restart-harness';

let llm: LLMock;
const gates: Gate[] = [];
const scenarios: { stop(): Promise<void> }[] = [];

/**
 * Picks requests by the agent's instructions (the start of the system prompt: a sub-agent's also
 * carries its supervisor's), the agent's own task (the last user message), and whether the text
 * already holds `done`.
 */
const request =
  (instructions: string, { task, done }: { task?: string; done?: string[] } = {}) =>
  (body: any) => {
    const messages: any[] = body?.messages ?? [];
    const text = JSON.stringify(messages);
    return (
      String(messages[0]?.content).startsWith(instructions) &&
      (task === undefined || messages.findLast(m => m.role === 'user')?.content === task) &&
      (done ?? []).every(part => text.includes(part))
    );
  };
const pending = (predicate: (body: any) => boolean, done: (body: any) => boolean) => (body: any) =>
  predicate(body) && !done(body);

beforeAll(async () => {
  llm = new LLMock({ port: 0 });
  await llm.start();
  // An agent with three approval-gated tool calls in one step.
  llm.on(
    { endpoint: 'chat', hasToolResult: false, predicate: request('Charge every card') },
    { toolCalls: [0, 1, 2].map(index => ({ id: `call_${index}`, name: 'charge', arguments: { index } })) },
  );
  llm.on(
    { endpoint: 'chat', hasToolResult: true, predicate: request('Charge every card') },
    { content: 'all charged' },
  );
  // A supervisor that delegates to two sub-agents in one step; each calls its gated tool once.
  const supervisorDone = request('Delegate to both', { done: ['alpha finished', 'beta finished'] });
  llm.on({ endpoint: 'chat', predicate: supervisorDone }, { content: 'Both delegations complete.' });
  llm.on(
    { endpoint: 'chat', predicate: pending(request('Delegate to both'), supervisorDone) },
    {
      toolCalls: ['Alpha', 'Beta'].map(name => ({
        id: `sup-tc-${name[0]}`,
        name: `agent-sub${name}`,
        arguments: { prompt: `do ${name.toLowerCase()}` },
      })),
    },
  );
  for (const label of ['alpha', 'beta']) {
    const done = request('Use your tool', { task: `do ${label}`, done: [`${label} done`] });
    llm.on({ endpoint: 'chat', predicate: done }, { content: `${label} finished.` });
    llm.on(
      { endpoint: 'chat', predicate: pending(request('Use your tool', { task: `do ${label}` }), done) },
      { toolCalls: [{ id: `inner-${label}`, name: 'gatedTool', arguments: { query: label } }] },
    );
  }
});

afterAll(async () => {
  await llm.stop();
});

afterEach(async () => {
  for (const gate of gates.splice(0)) gate.release();
  for (const scenario of scenarios.splice(0)) await scenario.stop();
});

const model = () => createOpenAI({ apiKey: 'test-key', baseURL: `${llm.url}/v1` }).chat('gpt-4o-mini');

/** Recovers the run from `checkpoint`; the recovered run reports no error. */
async function recover(scenario: ReturnType<typeof createRestartScenario>, checkpoint: Checkpoint) {
  const recovered = await scenario.restart(checkpoint, { closeOnSuspend: true });
  expect(recovered.streamErrors).toEqual([]);
  expect(recovered.executionError).toBeUndefined();
  return recovered;
}

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
          model: model(),
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

    const recovered = await recover(scenario, await original.checkpoint());

    expect(charges.filter(c => c.generation === 2)).toEqual([{ generation: 2, index: 0 }]);
    // The next call asks for its own approval.
    expect(recovered.chunkTypes).toContain('tool-call-approval');
  }, 30_000);
});

describe('durable agent: restart while an approved delegation is being resumed', () => {
  // Delegations to sub-agents run concurrently, so both suspend at once when each sub-agent's tool
  // needs approval. The approval of one goes through the instance that suspended the run, and the
  // process crashes before the loop's iteration workflow stores its resumed tool calls.
  const crashPoints: { point: string; hold: HoldWrite }[] = [
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
  async function crashWhileApproving(hold: HoldWrite) {
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
        const subAgent = (name: string) =>
          new core.Agent({
            id: `sub${name}`,
            name: `sub${name}`,
            description: `Does ${name.toLowerCase()}`,
            instructions: 'Use your tool.',
            model: model(),
            tools: {
              gatedTool: core.createTool({
                id: 'gatedTool',
                description: 'Approval-gated tool',
                inputSchema: z.object({ query: z.string() }),
                requireApproval: true,
                execute: async ({ query }: { query: string }) => {
                  executions.push({ generation, query });
                  return { result: `${query} done` };
                },
              }),
            },
          });
        return new core.Agent({
          id: 'supervisor',
          name: 'Supervisor',
          instructions: 'Delegate to both sub-agents.',
          model: model(),
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
    /** Approves `toolCallId` on the recovered graph and returns the reply's text. */
    const approve = async (recovered: { graph: any }, toolCallId: string) => {
      const resumed = await recovered.graph.agent.approveToolCall({ runId, toolCallId, memory, closeOnSuspend: true });
      let text = '';
      for await (const chunk of resumed.fullStream) {
        if (chunk.type === 'text-delta') text += chunk.payload.text;
      }
      return text;
    };
    return { scenario, checkpoint, executions, approve };
  }

  it.each(crashPoints)(
    'runs only the approved delegation after a crash $point',
    async ({ hold }) => {
      const { scenario, checkpoint, executions, approve } = await crashWhileApproving(hold);

      const recovered = await recover(scenario, checkpoint);

      expect(executions).toEqual([{ generation: 2, query: 'alpha' }]);
      // Beta's own approval is still pending, and still works.
      expect(await approve(recovered, 'sup-tc-B')).toBe('Both delegations complete.');
      expect(executions.map(e => e.query)).toEqual(['alpha', 'beta']);
    },
    60_000,
  );

  it.each(crashPoints)(
    'runs no delegation when the stored resume recorded no target, after a crash $point',
    async ({ hold }) => {
      // Runs stored before the target was recorded carry the approval but not which call it is for.
      const { scenario, checkpoint, executions, approve } = await crashWhileApproving(hold);
      const loop = checkpoint.rows.find(row => row.workflowName === DurableStepIds.AGENTIC_LOOP)!;
      const record = loop.snapshot.context[DurableStepIds.AGENTIC_EXECUTION] as any;
      expect(record.metadata.nestedResumeTarget).toEqual({ steps: [], label: 'sup-tc-A' });
      delete record.metadata.nestedResumeTarget;

      const recovered = await recover(scenario, checkpoint);

      expect(executions).toEqual([]);
      // Both approvals are still pending: approving each again runs it.
      await approve(recovered, 'sup-tc-A');
      expect(executions).toEqual([{ generation: 2, query: 'alpha' }]);
      expect(await approve(recovered, 'sup-tc-B')).toBe('Both delegations complete.');
      expect(executions.map(e => e.query)).toEqual(['alpha', 'beta']);
    },
    60_000,
  );
});
