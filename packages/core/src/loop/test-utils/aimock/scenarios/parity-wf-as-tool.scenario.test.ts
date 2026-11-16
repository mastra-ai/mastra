/**
 * Ported from validation harness case T55 (wf-as-tool), source 23f640a.
 * A tool returns a default-engine workflow's status; suspended workflows are
 * resumed directly, not by resuming the agent. Recovery belongs to COR-1449.
 */
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { createDurableAgent } from '../../../../agent/durable/create-durable-agent';
import { createEventedAgent } from '../../../../agent/durable/create-evented-agent';
import { EventEmitterPubSub } from '../../../../events/event-emitter';
import { Mastra } from '../../../../mastra';
import { MockMemory } from '../../../../memory/mock';
import { InMemoryStore } from '../../../../storage/mock';
import { createTool } from '../../../../tools';
import { createStep, createWorkflow } from '../../../../workflows';
import type { ParityEngine } from '../parity';
import { createRecordingModel, describeParity, textOnlyTape, toolCallTape } from '../parity';

async function drive(engine: ParityEngine, variant: 'run' | 'suspend') {
  const schema = z.object({ n: z.number() });
  const steps: string[] = [];
  const increment = (id: string) =>
    createStep({
      id,
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => {
        steps.push(id);
        return { n: inputData.n + 1 };
      },
    });
  const gate = createStep({
    id: 'gate',
    inputSchema: schema,
    outputSchema: schema,
    resumeSchema: z.object({ ok: z.boolean() }),
    execute: async ({ inputData, resumeData, suspend }) => (resumeData ? inputData : suspend({})),
  });
  const nested = createWorkflow({ id: 't55-wf-nested', inputSchema: schema, outputSchema: schema })
    .then(increment('inc'))
    .then(gate)
    .commit();
  const workflow =
    variant === 'run'
      ? createWorkflow({ id: 't55-wf', inputSchema: schema, outputSchema: schema })
          .then(increment('first'))
          .then(increment('block'))
          .then(increment('last'))
          .commit()
      : createWorkflow({ id: 't55-wf', inputSchema: schema, outputSchema: schema })
          .then(increment('before'))
          .dountil(nested, async ({ inputData }) => inputData.n >= 2)
          .then(increment('after'))
          .commit();
  const commits: string[] = [];
  const { model, requests } = createRecordingModel({
    tapes: [
      toolCallTape('runWorkflow', { n: 1 }, 't55-tool'),
      textOnlyTape(`workflow "${variant === 'run' ? 'success' : 'suspended'}"`),
    ],
  });
  const agent = new Agent({
    id: 't55-agent',
    name: 'T55',
    instructions: 'Run the workflow and report its status.',
    model,
    memory: new MockMemory(),
    tools: {
      runWorkflow: createTool({
        id: 'runWorkflow',
        description: 'Run the workflow with n.',
        inputSchema: schema,
        execute: async ({ n }) => {
          const run = await workflow.createRun({ runId: `wf-tool-1-${variant}` });
          const result = await run.start({ inputData: { n } });
          commits.push(result.status);
          return {
            status: result.status,
            result: result.status === 'success' ? result.result : null,
            suspended: result.status === 'suspended' ? result.suspended : null,
          };
        },
      }),
    },
  });
  const pubsub = new EventEmitterPubSub();
  const wrapper =
    engine === 'plain'
      ? undefined
      : engine === 'durable'
        ? createDurableAgent({ agent, pubsub })
        : createEventedAgent({ agent, pubsub });
  const host = new Mastra({
    agents: { agent: wrapper ?? agent },
    workflows: { [workflow.id]: workflow },
    storage: new InMemoryStore(),
    logger: false,
  });
  let cleanup: (() => void) | undefined;
  try {
    const options = { maxSteps: 4, memory: { thread: 't55-thread', resource: 't55-resource' } };
    const wrapped = wrapper ? await wrapper.stream('Go.', options) : undefined;
    cleanup = wrapped?.cleanup;
    const output = wrapped?.output ?? (await agent.stream('Go.', options));
    const statuses: string[] = [];
    const types: string[] = [];
    for await (const chunk of output.fullStream) {
      types.push(chunk.type);
      if (chunk.type === 'tool-result')
        statuses.push(z.object({ status: z.string() }).parse(chunk.payload.result).status);
    }
    const status = variant === 'run' ? 'success' : 'suspended';
    expect(statuses).toEqual([status]);
    expect(commits).toEqual([status]);
    expect(types.filter(type => type === 'error')).toEqual([]);
    expect(types.filter(type => type === 'finish')).toHaveLength(1);
    expect(requests).toHaveLength(2);
    const run = await workflow.createRun({ runId: `wf-tool-1-${variant}` });
    const workflows = await host.getStorage()!.getStore('workflows');
    const snapshot = await workflows!.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
    expect(snapshot?.status).toBe(status);
    if (variant === 'suspend') {
      let resumed = await run.resume({ step: ['t55-wf-nested', 'gate'], resumeData: { ok: true } });
      const resumedStatuses = [{ status: resumed.status }];
      if (resumed.status === 'suspended') {
        resumed = await run.resume({ step: ['t55-wf-nested', 'gate'], resumeData: { ok: true } });
        resumedStatuses.push({ status: resumed.status });
      }
      expect(resumedStatuses).toEqual([{ status: 'success' }]);
      expect(resumed.status).toBe('success');
      expect(steps).toEqual(['before', 'inc', 'after']);
      return {
        variant,
        results: statuses,
        snapshot: snapshot?.status,
        resumed: resumedStatuses,
        final: resumed.status,
      };
    }
    expect(steps).toEqual(['first', 'block', 'last']);
    return { variant, results: statuses, commits, snapshot: snapshot?.status, steps };
  } finally {
    cleanup?.();
    await host.shutdown({ drainTimeout: 1000 });
  }
}

describeParity('wf-as-tool parity', target => {
  it.each(['run', 'suspend'] as const)(
    '%s: workflow status and external resume remain usable',
    async variant => {
      expect(await drive(target, variant)).toEqual(await drive('plain', variant));
    },
    30_000,
  );
});
