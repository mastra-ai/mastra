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
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { Inngest } from 'inngest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createStep, init } from '../index';

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
});
