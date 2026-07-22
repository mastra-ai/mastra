/**
 * Declarative `agent` / `tool` / `mapping` step entries.
 *
 * These tests cover the first-class declarative variants of the workflow
 * step-graph: their construction (serialized graph shape), the interpreter that
 * materializes them into runnable steps, the shared helpers, and end-to-end
 * runtime behavior across both execution engines.
 */
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { createWorkflow } from '../create';
import { DefaultExecutionEngine } from '../default';
import type { SerializedStepFlowEntry } from '../types';
import { getSingleStepEntryId, getStepIds, isSingleStepEntry } from '../utils';
import { createStep } from '../workflow';

type Engine = { name: 'default' | 'evented'; evented: boolean };

const ENGINES: Engine[] = [
  { name: 'default', evented: false },
  { name: 'evented', evented: true },
];

function textAgent(id: string, response: string) {
  return new Agent({
    id,
    name: id,
    instructions: 'You echo a fixed response.',
    model: new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: response },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
      }),
    }),
  });
}

const doubleTool = createTool({
  id: 'double-tool',
  description: 'Doubles a number',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ doubled: z.number() }),
  execute: async ({ value }) => ({ doubled: value * 2 }),
});

describe('declarative step entries - construction & serialized graph shape', () => {
  it('.agent() pushes a declarative agent entry', () => {
    const agent = textAgent('writer', 'hi');
    const wf = createWorkflow({ id: 'wf-agent', inputSchema: z.object({ prompt: z.string() }), outputSchema: z.any() })
      .agent(agent)
      .commit();

    const entry = wf.serializedStepGraph[0] as Extract<SerializedStepFlowEntry, { type: 'agent' }>;
    expect(entry.type).toBe('agent');
    expect(entry.id).toBe('writer');
    expect(entry.agentId).toBe('writer');
  });

  it('.tool() pushes a declarative tool entry', () => {
    const wf = createWorkflow({ id: 'wf-tool', inputSchema: z.object({ value: z.number() }), outputSchema: z.any() })
      .tool(doubleTool)
      .commit();

    const entry = wf.serializedStepGraph[0] as Extract<SerializedStepFlowEntry, { type: 'tool' }>;
    expect(entry.type).toBe('tool');
    expect(entry.id).toBe('double-tool');
    expect(entry.toolId).toBe('double-tool');
  });

  it('.map() pushes a declarative mapping entry', () => {
    const wf = createWorkflow({ id: 'wf-map', inputSchema: z.object({ value: z.number() }), outputSchema: z.any() })
      .map(async ({ inputData }) => ({ value: inputData.value + 1 }))
      .commit();

    const entry = wf.serializedStepGraph[0] as Extract<SerializedStepFlowEntry, { type: 'mapping' }>;
    expect(entry.type).toBe('mapping');
    expect(typeof entry.mapConfig).toBe('string');
  });

  it('.agent() supports a separate step id distinct from agentId', () => {
    const agent = textAgent('shared-agent', 'hi');
    const wf = createWorkflow({ id: 'wf-sep', inputSchema: z.object({ prompt: z.string() }), outputSchema: z.any() })
      .agent(agent, undefined, { id: 'first' })
      .map(async () => ({ prompt: 'again' }))
      .agent(agent, undefined, { id: 'second' })
      .commit();

    const agentEntries = wf.serializedStepGraph.filter(e => e.type === 'agent') as Extract<
      SerializedStepFlowEntry,
      { type: 'agent' }
    >[];
    expect(agentEntries.map(e => e.id)).toEqual(['first', 'second']);
    expect(agentEntries.every(e => e.agentId === 'shared-agent')).toBe(true);
  });

  it('.then(createStep(agent)) emits an agent entry (option B)', () => {
    const agent = textAgent('opt-b-agent', 'hi');
    const wf = createWorkflow({
      id: 'wf-then-agent',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.any(),
    })
      .then(createStep(agent))
      .commit();

    expect(wf.serializedStepGraph[0]!.type).toBe('agent');
  });

  it('.then(createStep(tool)) emits a tool entry (option B)', () => {
    const wf = createWorkflow({
      id: 'wf-then-tool',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.any(),
    })
      .then(createStep(doubleTool))
      .commit();

    expect(wf.serializedStepGraph[0]!.type).toBe('tool');
  });

  it('agent/tool nested in .parallel() serialize as declarative child entries', () => {
    const agent = textAgent('par-agent', 'hi');
    const wf = createWorkflow({
      id: 'wf-parallel',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.any(),
    })
      .parallel([createStep(agent), createStep(doubleTool)])
      .commit();

    const parallel = wf.serializedStepGraph[0] as Extract<SerializedStepFlowEntry, { type: 'parallel' }>;
    expect(parallel.type).toBe('parallel');
    expect(parallel.steps.map(s => s.type).sort()).toEqual(['agent', 'tool']);
  });
});

describe('per-type execute methods', () => {
  function makeEngine(mastra?: Mastra) {
    return new DefaultExecutionEngine({
      mastra,
      options: { validateInputs: true, shouldPersistSnapshot: () => false },
    });
  }

  it('executeAgent throws a clear error when the agent id cannot be resolved', async () => {
    const engine = makeEngine(new Mastra({ logger: false }));
    await expect(engine.executeAgent({ entry: { type: 'agent', id: 'a', agentId: 'missing' } } as any)).rejects.toThrow(
      /missing/,
    );
  });

  it('executeTool throws a clear error when the tool id cannot be resolved', async () => {
    const engine = makeEngine(new Mastra({ logger: false }));
    await expect(
      engine.executeTool({ entry: { type: 'tool', id: 't', toolId: 'missing-tool' } } as any),
    ).rejects.toThrow(/missing-tool/);
  });
});

describe('single step-like helpers', () => {
  const step = createStep({ id: 's', inputSchema: z.any(), outputSchema: z.any(), execute: async () => ({}) });

  it('isSingleStepEntry is true for step/agent/tool/mapping', () => {
    expect(isSingleStepEntry({ type: 'step', step })).toBe(true);
    expect(isSingleStepEntry({ type: 'agent', id: 'a', agentId: 'a' })).toBe(true);
    expect(isSingleStepEntry({ type: 'tool', id: 't', toolId: 't' })).toBe(true);
    expect(isSingleStepEntry({ type: 'mapping', id: 'm', mapConfig: async () => ({}) })).toBe(true);
  });

  it('isSingleStepEntry is false for control-flow entries', () => {
    expect(isSingleStepEntry({ type: 'parallel', steps: [] })).toBe(false);
    expect(isSingleStepEntry({ type: 'sleep', id: 'x', duration: 1 })).toBe(false);
  });

  it('getSingleStepEntryId reads the wrapped step id or the entry id', () => {
    expect(getSingleStepEntryId({ type: 'step', step })).toBe('s');
    expect(getSingleStepEntryId({ type: 'agent', id: 'agent-step', agentId: 'a' })).toBe('agent-step');
  });

  it('getStepIds reads declarative ids for top-level and nested entries', () => {
    expect(getStepIds({ type: 'agent', id: 'a', agentId: 'x' })).toEqual(['a']);
    expect(getStepIds({ type: 'mapping', id: 'm', mapConfig: async () => ({}) })).toEqual(['m']);
    expect(
      getStepIds({
        type: 'parallel',
        steps: [
          { type: 'agent', id: 'a', agentId: 'x' },
          { type: 'tool', id: 't', toolId: 'y' },
        ],
      }),
    ).toEqual(['a', 't']);
  });
});

describe.each(ENGINES)('declarative step runtime ($name engine)', ({ evented }) => {
  beforeEach(() => {
    if (evented) {
      process.env.MASTRA_EVENTED_EXECUTION = 'true';
    } else {
      delete process.env.MASTRA_EVENTED_EXECUTION;
    }
  });
  afterEach(() => {
    delete process.env.MASTRA_EVENTED_EXECUTION;
  });

  function bind(
    workflow: ReturnType<typeof createWorkflow>,
    extra?: { agents?: Record<string, Agent>; tools?: Record<string, any> },
  ) {
    const mastra = new Mastra({
      workflows: { [workflow.id]: workflow },
      agents: extra?.agents,
      tools: extra?.tools,
      storage: new InMemoryStore(),
      logger: false,
    });
    workflow.__registerMastra(mastra);
    return mastra;
  }

  it('.map() transforms data', async () => {
    const wf = createWorkflow({ id: 'rt-map', inputSchema: z.object({ value: z.number() }), outputSchema: z.any() })
      .map(async ({ inputData }) => ({ doubled: inputData.value * 2 }))
      .commit();
    bind(wf);

    const run = await wf.createRun();
    const result = await run.start({ inputData: { value: 21 } });
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.result).toEqual({ doubled: 42 });
    }
  });

  it('.tool() executes the tool and validates output', async () => {
    const wf = createWorkflow({ id: 'rt-tool', inputSchema: z.object({ value: z.number() }), outputSchema: z.any() })
      .tool(doubleTool)
      .commit();
    bind(wf);

    const run = await wf.createRun();
    const result = await run.start({ inputData: { value: 5 } });
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect((result.steps['double-tool'] as any).output).toEqual({ doubled: 10 });
    }
  });

  it('.agent() executes the agent and returns { text }', async () => {
    const agent = textAgent('rt-agent', 'hello world');
    const wf = createWorkflow({
      id: 'rt-agent-wf',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.any(),
    })
      .agent(agent)
      .commit();
    bind(wf, { agents: { 'rt-agent': agent } });

    const run = await wf.createRun();
    const result = await run.start({ inputData: { prompt: 'say hi' } });
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect((result.steps['rt-agent'] as any).output.text).toBe('hello world');
    }
  });

  it('resolves a string-id agent from the Mastra registry at execution', async () => {
    const agent = textAgent('registered-agent', 'from registry');
    const wf = createWorkflow({ id: 'rt-strid', inputSchema: z.object({ prompt: z.string() }), outputSchema: z.any() })
      .agent('registered-agent')
      .commit();
    bind(wf, { agents: { 'registered-agent': agent } });

    const run = await wf.createRun();
    const result = await run.start({ inputData: { prompt: 'hi' } });
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect((result.steps['registered-agent'] as any).output.text).toBe('from registry');
    }
  });

  it('resolves an agent by id when its Mastra registration key differs', async () => {
    const agent = textAgent('registered-agent-id', 'from agent id');
    const wf = createWorkflow({
      id: 'rt-agent-id',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.any(),
    })
      .agent('registered-agent-id')
      .commit();
    bind(wf, { agents: { registeredAgentKey: agent } });

    const run = await wf.createRun();
    const result = await run.start({ inputData: { prompt: 'hi' } });
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect((result.steps['registered-agent-id'] as any).output.text).toBe('from agent id');
    }
  });

  it('resolves a string-id tool from the Mastra registry at execution', async () => {
    const wf = createWorkflow({
      id: 'rt-strid-tool',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.any(),
    })
      .tool('registered-tool')
      .commit();
    bind(wf, { tools: { 'registered-tool': doubleTool } });

    const run = await wf.createRun();
    const result = await run.start({ inputData: { value: 5 } });
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect((result.steps['registered-tool'] as any).output).toEqual({ doubled: 10 });
    }
  });

  it('surfaces a clear error when a string-id tool is not registered on Mastra', async () => {
    const wf = createWorkflow({
      id: 'rt-strid-tool-missing',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.any(),
    })
      .tool('nope')
      .commit();
    bind(wf);

    const run = await wf.createRun();
    await expect(run.start({ inputData: { value: 1 } })).rejects.toThrow(/nope/);
  });

  it('runs the same agent twice under distinct step ids', async () => {
    const agent = textAgent('twice-agent', 'echo');
    const wf = createWorkflow({ id: 'rt-twice', inputSchema: z.object({ prompt: z.string() }), outputSchema: z.any() })
      .agent(agent, undefined, { id: 'first' })
      .map(async () => ({ prompt: 'again' }))
      .agent(agent, undefined, { id: 'second' })
      .commit();
    bind(wf, { agents: { 'twice-agent': agent } });

    const run = await wf.createRun();
    const result = await run.start({ inputData: { prompt: 'hi' } });
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect((result.steps['first'] as any).output.text).toBe('echo');
      expect((result.steps['second'] as any).output.text).toBe('echo');
    }
  });

  it('executes a tool nested in .parallel()', async () => {
    const passthrough = createStep({
      id: 'passthrough',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: async ({ inputData }) => ({ value: inputData.value }),
    });
    const wf = createWorkflow({
      id: 'rt-parallel',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.any(),
    })
      .parallel([createStep(doubleTool), passthrough])
      .commit();
    bind(wf);

    const run = await wf.createRun();
    const result = await run.start({ inputData: { value: 4 } });
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect((result.steps['double-tool'] as any).output).toEqual({ doubled: 8 });
      expect((result.steps['passthrough'] as any).output).toEqual({ value: 4 });
    }
  });

  it('executes an agent nested in .parallel() via per-type child dispatch', async () => {
    const agent = textAgent('par-rt-agent', 'parallel hi');
    const passthrough = createStep({
      id: 'par-passthrough',
      inputSchema: z.object({ prompt: z.string(), value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: async ({ inputData }) => ({ value: inputData.value }),
    });
    const wf = createWorkflow({
      id: 'rt-parallel-agent',
      inputSchema: z.object({ prompt: z.string(), value: z.number() }),
      outputSchema: z.any(),
    })
      .parallel([createStep(agent), passthrough])
      .commit();
    bind(wf, { agents: { 'par-rt-agent': agent } });

    const run = await wf.createRun();
    const result = await run.start({ inputData: { prompt: 'hi', value: 7 } });
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect((result.steps['par-rt-agent'] as any).output.text).toBe('parallel hi');
      expect((result.steps['par-passthrough'] as any).output).toEqual({ value: 7 });
    }
  });
});

/**
 * The evented engine interprets each declarative step type with its own run event
 * (`workflow.agent.run` / `workflow.tool.run` / `workflow.mapping.run`) instead of
 * materializing into a generic `workflow.step.run`. These tests drive the
 * `WorkflowEventProcessor` directly (via `handleWorkflowEvent`, pumping the
 * `workflows` topic) since the env-gated leg above runs the default engine.
 */
describe('evented engine - per-type run events', () => {
  function bindEvented(workflow: ReturnType<typeof createWorkflow>, extra?: { agents?: Record<string, Agent> }) {
    const mastra = new Mastra({
      workflows: { [workflow.id]: workflow },
      agents: extra?.agents,
      storage: new InMemoryStore(),
      logger: false,
    });
    workflow.__registerMastra(mastra);
    return mastra;
  }

  // Publish workflow.start and synchronously pump every follow-up `workflows`
  // event back through the processor until the run drains, collecting event types.
  async function driveEvented(mastra: Mastra, workflowId: string, runId: string, inputData: any) {
    const seen: string[] = [];
    const pending: any[] = [];
    await mastra.pubsub.subscribe('workflows', async (event: any) => {
      seen.push(event.type);
      pending.push(event);
    });
    await mastra.pubsub.publish('workflows', {
      type: 'workflow.start',
      runId,
      data: {
        workflowId,
        runId,
        executionPath: [0],
        stepResults: {},
        prevResult: { status: 'success', output: inputData },
        activeSteps: {},
        requestContext: {},
      },
    });
    let guard = 0;
    while (pending.length && guard++ < 2000) {
      await mastra.handleWorkflowEvent(pending.shift());
    }
    return seen;
  }

  it('schedules a .map() step with its own workflow.mapping.run event', async () => {
    const wf = createWorkflow({ id: 'ev-map', inputSchema: z.object({ value: z.number() }), outputSchema: z.any() })
      .map(async ({ inputData }) => ({ doubled: inputData.value * 2 }))
      .commit();
    const mastra = bindEvented(wf);

    const seen = await driveEvented(mastra, 'ev-map', 'run-map', { value: 21 });

    expect(seen).toContain('workflow.mapping.run');
  });

  it('schedules a .agent() step with its own workflow.agent.run event', async () => {
    const agent = textAgent('ev-agent', 'hi');
    const wf = createWorkflow({
      id: 'ev-agent-wf',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.any(),
    })
      .agent(agent)
      .commit();
    const mastra = bindEvented(wf, { agents: { 'ev-agent': agent } });

    const seen = await driveEvented(mastra, 'ev-agent-wf', 'run-agent', { prompt: 'hi' });

    expect(seen).toContain('workflow.agent.run');
  });

  it('schedules a .tool() step with its own workflow.tool.run event', async () => {
    const wf = createWorkflow({ id: 'ev-tool', inputSchema: z.object({ value: z.number() }), outputSchema: z.any() })
      .tool(doubleTool)
      .commit();
    const mastra = bindEvented(wf);

    const seen = await driveEvented(mastra, 'ev-tool', 'run-tool', { value: 5 });

    expect(seen).toContain('workflow.tool.run');
  });

  it('dispatches a declarative tool child inside .parallel() with its per-type run event', async () => {
    const passthrough = createStep({
      id: 'ev-par-passthrough',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: async ({ inputData }) => ({ value: inputData.value }),
    });
    // createStep(doubleTool) becomes a declarative `tool` child once it lands in the graph.
    const wf = createWorkflow({ id: 'ev-par', inputSchema: z.object({ value: z.number() }), outputSchema: z.any() })
      .parallel([createStep(doubleTool), passthrough])
      .commit();
    const mastra = bindEvented(wf);

    const seen = await driveEvented(mastra, 'ev-par', 'run-par', { value: 4 });

    expect(seen).toContain('workflow.tool.run');
  });
});
