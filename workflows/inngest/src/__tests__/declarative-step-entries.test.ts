/**
 * Construction-level coverage for the declarative `agent` / `tool` / `mapping`
 * step entries on the Inngest workflow.
 *
 * The Inngest workflow extends the core `Workflow`, so the builders are
 * inherited. These tests confirm an `InngestWorkflow` emits the same declarative
 * serialized graph entries (both via the dedicated builders and via the
 * `.then(createStep(agent|tool))` path) without requiring a running Inngest dev
 * server.
 */
import { Agent, TripWire } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { Inngest } from 'inngest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createStep, init } from '../index';
import type { InngestWorkflow } from '../workflow';

const inngest = new Inngest({ id: 'declarative-test' });
const { createWorkflow } = init(inngest);

const writer = new Agent({
  id: 'writer-agent',
  name: 'writer-agent',
  instructions: 'noop',
  model: {} as any,
});

const doubleTool = createTool({
  id: 'double-tool',
  description: 'Doubles a number',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ doubled: z.number() }),
  execute: async ({ value }) => ({ doubled: value * 2 }),
});

describe('inngest declarative step entries', () => {
  it('.agent()/.tool()/.map() builders push declarative entries', () => {
    const wf = createWorkflow({
      id: 'inngest-builders',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.any(),
    })
      .agent(writer)
      .map(async () => ({ value: 1 }))
      .tool(doubleTool)
      .commit();

    expect(wf.serializedStepGraph.map(e => e.type)).toEqual(['agent', 'mapping', 'tool']);
    const agentEntry = wf.serializedStepGraph[0] as Extract<SerializedStepFlowEntry, { type: 'agent' }>;
    expect(agentEntry.agentId).toBe('writer-agent');
    const toolEntry = wf.serializedStepGraph[2] as Extract<SerializedStepFlowEntry, { type: 'tool' }>;
    expect(toolEntry.toolId).toBe('double-tool');
  });

  it('.then(createStep(agent|tool)) emits declarative agent/tool entries (option B)', () => {
    const wf = createWorkflow({
      id: 'inngest-option-b',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.any(),
    })
      .then(createStep(writer))
      .map(async () => ({ value: 2 }))
      .then(createStep(doubleTool))
      .commit();

    expect(wf.serializedStepGraph.map(e => e.type)).toEqual(['agent', 'mapping', 'tool']);
  });

  it('detects nested InngestWorkflows used as loop and foreach bodies', () => {
    // Loop / foreach bodies are SingleStepEntry wrappers, so nested-workflow
    // detection must unwrap `{ type: 'step', step: workflow }` bodies.
    const loopBody = createWorkflow({
      id: 'nested-loop-body',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    }).commit() as unknown as InngestWorkflow;

    const foreachBody = createWorkflow({
      id: 'nested-foreach-body',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    }).commit() as unknown as InngestWorkflow;

    const parent = createWorkflow({
      id: 'nested-bodies-parent',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.any(),
    })
      .dountil(loopBody as any, async ({ inputData }) => (inputData as any).value > 0)
      .map(async ({ inputData }) => [inputData])
      .foreach(foreachBody as any)
      .commit() as unknown as InngestWorkflow;

    // getFunctions must include the parent + both nested workflow functions.
    expect(parent.getFunctions()).toHaveLength(3);

    // The pubsub factory must propagate into loop/foreach bodies too.
    const factory = (p: any) => p;
    parent.__setPubsubFactory(factory);
    expect(loopBody.__getPubsubFactory()).toBe(factory);
    expect(foreachBody.__getPubsubFactory()).toBe(factory);
  });
});

describe('inngest step factories delegate to core entry executors', () => {
  it('createStep(agent|tool) preserves __agentRef/__toolRef metadata for declarative conversion', () => {
    // The builders (`then`/`parallel`/`branch`/`dowhile`/`dountil`/`foreach`)
    // rely on this metadata to convert factory steps into declarative entries;
    // losing it would silently fall back to opaque `type: 'step'` entries.
    const agentStep = createStep(writer) as any;
    expect(agentStep.component).toBe('AGENT');
    expect(agentStep.__agentRef).toBe(writer);

    const toolStep = createStep(doubleTool) as any;
    expect(toolStep.component).toBe('TOOL');
    expect(toolStep.__toolRef).toBe(doubleTool);
  });

  it('createStep(agent).execute aborts with TripWire on tripwire chunks (core executor semantics)', async () => {
    // Pre-delegation, the inngest-local execute body had no tripwire handling:
    // a tripwire chunk was forwarded and the step returned success. This pins
    // that direct execution now shares core's `runAgentEntry`.
    const trippingAgent = {
      id: 'tripping-agent',
      name: 'tripping-agent',
      getDescription: () => 'always trips',
      getModel: async () => ({ specificationVersion: 'v2' }),
      generate: async () => ({ text: 'unused' }),
      stream: async () => ({
        text: Promise.resolve(''),
        fullStream: (async function* () {
          yield { type: 'text-delta', textDelta: 'partial' };
          yield { type: 'tripwire', payload: { reason: 'output processor tripped' } };
        })(),
      }),
    };

    const step = createStep(trippingAgent as any);
    const written: unknown[] = [];
    const ctx = {
      inputData: { prompt: 'hello' },
      runId: 'run-1',
      requestContext: {},
      abortSignal: new AbortController().signal,
      abort: () => {
        throw new Error('abort() should not be called for tripwire');
      },
      writer: {
        write: async (chunk: unknown) => {
          written.push(chunk);
        },
      },
    };

    await expect((step as any).execute(ctx)).rejects.toThrowError(TripWire);
    await expect((step as any).execute(ctx)).rejects.toThrow('output processor tripped');
    // Chunks up to the tripwire are still forwarded to the step writer.
    expect(written.some(c => (c as any).type === 'text-delta')).toBe(true);
  });
});
