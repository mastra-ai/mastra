import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { EventedWorkflow } from '../workflow';
import { getNestedWorkflow, getStepId } from './utils';

function createStepEntry(id: string) {
  return {
    type: 'step' as const,
    step: {
      id,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async () => ({}),
    },
  };
}

function createWorkflow(id: string) {
  return new EventedWorkflow({
    id,
    inputSchema: z.object({}),
    outputSchema: z.object({}),
  });
}

describe('getStepId', () => {
  it('resolves the id of a plain step entry', () => {
    const workflow = createWorkflow('workflow');
    workflow.stepGraph[0] = createStepEntry('innerStep');

    expect(getStepId(workflow as any, [0])).toBe('innerStep');
  });

  it('resolves ids of declarative agent / tool / mapping entries', () => {
    const workflow = createWorkflow('workflow');
    workflow.stepGraph[0] = { type: 'agent', id: 'agent-step', agentId: 'my-agent' } as any;
    workflow.stepGraph[1] = { type: 'tool', id: 'tool-step', toolId: 'my-tool' } as any;
    workflow.stepGraph[2] = { type: 'mapping', id: 'mapping-step', mapConfig: {} } as any;

    expect(getStepId(workflow as any, [0])).toBe('agent-step');
    expect(getStepId(workflow as any, [1])).toBe('tool-step');
    expect(getStepId(workflow as any, [2])).toBe('mapping-step');
  });

  it('resolves ids inside parallel and conditional containers', () => {
    for (const type of ['parallel', 'conditional'] as const) {
      const workflow = createWorkflow('workflow');
      workflow.stepGraph[0] = {
        type,
        steps: [createStepEntry('first'), createStepEntry('second')],
      } as any;

      expect(getStepId(workflow as any, [0, 0])).toBe('first');
      expect(getStepId(workflow as any, [0, 1])).toBe('second');
    }
  });

  it('resolves the body entry id for loop and foreach', () => {
    const workflow = createWorkflow('workflow');
    workflow.stepGraph[0] = {
      type: 'loop',
      step: createStepEntry('loopBody'),
      loopType: 'dowhile',
    } as any;
    workflow.stepGraph[1] = {
      type: 'foreach',
      step: { type: 'agent', id: 'foreachAgent', agentId: 'my-agent' },
      opts: { concurrency: 1 },
    } as any;

    expect(getStepId(workflow as any, [0])).toBe('loopBody');
    expect(getStepId(workflow as any, [1])).toBe('foreachAgent');
  });

  it('resolves the id of a nested workflow wrapped as a step entry', () => {
    const innerWorkflow = createWorkflow('innerWorkflow');
    const outerWorkflow = createWorkflow('outerWorkflow');
    outerWorkflow.stepGraph[0] = { type: 'step', step: innerWorkflow } as any;

    expect(getStepId(outerWorkflow as any, [0])).toBe('innerWorkflow');
  });

  it('returns null for invalid or empty paths', () => {
    const workflow = createWorkflow('workflow');
    workflow.stepGraph[0] = createStepEntry('innerStep');

    expect(getStepId(workflow as any, [999])).toBeNull();
    expect(getStepId(workflow as any, [])).toBeNull();
  });

  it('returns null for non-step-like entries', () => {
    const workflow = createWorkflow('workflow');
    workflow.stepGraph[0] = { type: 'sleep', id: 'sleep-step', duration: 10 } as any;

    expect(getStepId(workflow as any, [0])).toBeNull();
  });
});

describe('getNestedWorkflow', () => {
  function createMastraStub(workflow: ReturnType<typeof createWorkflow>) {
    return {
      __hasInternalWorkflow: () => false,
      getWorkflow: () => workflow,
    } as any;
  }

  it('resolves a nested workflow wrapped as a step entry', () => {
    const innerWorkflow = createWorkflow('innerWorkflow');
    const outerWorkflow = createWorkflow('outerWorkflow');
    outerWorkflow.stepGraph[0] = { type: 'step', step: innerWorkflow } as any;

    const result = getNestedWorkflow(createMastraStub(outerWorkflow), {
      workflowId: 'outerWorkflow',
      executionPath: [0],
      resumeSteps: [],
    } as any);

    expect(result).toBe(innerWorkflow);
  });

  it('resolves a nested workflow inside parallel and conditional containers', () => {
    for (const type of ['parallel', 'conditional'] as const) {
      const innerWorkflow = createWorkflow('innerWorkflow');
      const outerWorkflow = createWorkflow('outerWorkflow');
      outerWorkflow.stepGraph[0] = {
        type,
        steps: [createStepEntry('otherStep'), { type: 'step', step: innerWorkflow }],
      } as any;

      const result = getNestedWorkflow(createMastraStub(outerWorkflow), {
        workflowId: 'outerWorkflow',
        executionPath: [0, 1],
        resumeSteps: [],
      } as any);

      expect(result).toBe(innerWorkflow);
    }
  });

  it('resolves a nested workflow used as a loop / foreach body', () => {
    for (const type of ['loop', 'foreach'] as const) {
      const innerWorkflow = createWorkflow('innerWorkflow');
      const outerWorkflow = createWorkflow('outerWorkflow');
      outerWorkflow.stepGraph[0] = {
        type,
        step: { type: 'step', step: innerWorkflow },
      } as any;

      const result = getNestedWorkflow(createMastraStub(outerWorkflow), {
        workflowId: 'outerWorkflow',
        executionPath: [0],
        resumeSteps: [],
      } as any);

      expect(result).toBe(innerWorkflow);
    }
  });

  it('returns null when the entry is not a workflow', () => {
    const outerWorkflow = createWorkflow('outerWorkflow');
    outerWorkflow.stepGraph[0] = createStepEntry('plainStep');
    outerWorkflow.stepGraph[1] = { type: 'agent', id: 'agent-step', agentId: 'my-agent' } as any;

    const mastra = createMastraStub(outerWorkflow);
    expect(
      getNestedWorkflow(mastra, { workflowId: 'outerWorkflow', executionPath: [0], resumeSteps: [] } as any),
    ).toBeNull();
    expect(
      getNestedWorkflow(mastra, { workflowId: 'outerWorkflow', executionPath: [1], resumeSteps: [] } as any),
    ).toBeNull();
  });
});
