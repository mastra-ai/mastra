import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

import type { Mastra } from '../../../mastra';
import type {
  AgentStepDef,
  ToolStepDef,
  WorkflowStepDef,
  TransformStepDef,
  SuspendStepDef,
  DeclarativeStepDefinition,
} from '../../../storage/types';
import {
  resolveStep,
  resolveAgentStep,
  resolveToolStep,
  resolveWorkflowStep,
  resolveTransformStep,
  resolveSuspendStep,
  isVariableRef,
} from '../resolve-steps';

// Mock Mastra instance
function createMockMastra(overrides: Partial<Mastra> = {}): Mastra {
  return {
    getAgent: vi.fn(),
    getTool: vi.fn(),
    getWorkflow: vi.fn(),
    ...overrides,
  } as unknown as Mastra;
}

describe('resolveAgentStep', () => {
  it('should create a step with correct id', () => {
    const mastra = createMockMastra();
    const def: AgentStepDef = {
      type: 'agent',
      agentId: 'test-agent',
      input: { prompt: { $ref: 'input.message' } },
    };

    const step = resolveAgentStep(mastra, 'my-agent-step', def);

    expect(step.id).toBe('my-agent-step');
    expect(step.description).toBe('Agent step calling test-agent');
  });

  it('should have default output schema with text when no structuredOutput defined', () => {
    const mastra = createMockMastra();
    const def: AgentStepDef = {
      type: 'agent',
      agentId: 'test-agent',
      input: { prompt: { $ref: 'input.message' } },
    };

    const step = resolveAgentStep(mastra, 'agent-step', def);

    // The output schema should be z.object({ text: z.string() })
    expect(step.outputSchema).toBeDefined();
    const result = step.outputSchema.parse({ text: 'hello' });
    expect(result).toEqual({ text: 'hello' });
  });

  it('should use structuredOutput schema when provided', () => {
    const mastra = createMockMastra();
    const def: AgentStepDef = {
      type: 'agent',
      agentId: 'test-agent',
      input: { prompt: { $ref: 'input.message' } },
      structuredOutput: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' },
        },
        required: ['name'],
      },
    };

    const step = resolveAgentStep(mastra, 'agent-step', def);

    // Should parse successfully with the schema
    expect(step.outputSchema).toBeDefined();
    const result = step.outputSchema.parse({ name: 'John', age: 30 });
    expect(result).toEqual({ name: 'John', age: 30 });
  });

  it('should have inputSchema as z.unknown() to accept any input', () => {
    const mastra = createMockMastra();
    const def: AgentStepDef = {
      type: 'agent',
      agentId: 'test-agent',
      input: { prompt: { $ref: 'input.message' } },
    };

    const step = resolveAgentStep(mastra, 'agent-step', def);

    // Should accept any value (object, string, null, etc.)
    expect(step.inputSchema.parse({ extra: 'value', __context: {} })).toEqual({ extra: 'value', __context: {} });
    expect(step.inputSchema.parse('string value')).toBe('string value');
    expect(step.inputSchema.parse(null)).toBe(null);
    expect(step.inputSchema.parse(123)).toBe(123);
  });
});

describe('resolveToolStep', () => {
  it('should create a step with correct id', () => {
    const mastra = createMockMastra();
    const def: ToolStepDef = {
      type: 'tool',
      toolId: 'test-tool',
      input: { param1: { $ref: 'input.value' } },
    };

    const step = resolveToolStep(mastra, 'my-tool-step', def);

    expect(step.id).toBe('my-tool-step');
    expect(step.description).toBe('Tool step calling test-tool');
  });

  it('should have outputSchema as z.unknown()', () => {
    const mastra = createMockMastra();
    const def: ToolStepDef = {
      type: 'tool',
      toolId: 'test-tool',
      input: { param1: { $literal: 'value' } },
    };

    const step = resolveToolStep(mastra, 'tool-step', def);

    // z.unknown() accepts anything
    expect(step.outputSchema.parse('anything')).toBe('anything');
    expect(step.outputSchema.parse({ nested: true })).toEqual({ nested: true });
  });

  it('should have inputSchema as z.unknown() to accept any input', () => {
    const mastra = createMockMastra();
    const def: ToolStepDef = {
      type: 'tool',
      toolId: 'test-tool',
      input: {},
    };

    const step = resolveToolStep(mastra, 'tool-step', def);

    // Should accept any value - actual input extraction is done via $ref evaluation
    expect(step.inputSchema.parse({ any: 'data' })).toEqual({ any: 'data' });
    expect(step.inputSchema.parse('string')).toBe('string');
    expect(step.inputSchema.parse(null)).toBe(null);
  });
});

describe('resolveWorkflowStep', () => {
  it('should create a step with correct id', () => {
    const mastra = createMockMastra();
    const def: WorkflowStepDef = {
      type: 'workflow',
      workflowId: 'nested-workflow',
      input: { data: { $ref: 'input.data' } },
    };

    const step = resolveWorkflowStep(mastra, 'my-workflow-step', def);

    expect(step.id).toBe('my-workflow-step');
    expect(step.description).toBe('Workflow step calling nested-workflow');
  });

  it('should have outputSchema as z.unknown()', () => {
    const mastra = createMockMastra();
    const def: WorkflowStepDef = {
      type: 'workflow',
      workflowId: 'nested-workflow',
      input: {},
    };

    const step = resolveWorkflowStep(mastra, 'workflow-step', def);

    expect(step.outputSchema.parse({ result: 'value' })).toEqual({ result: 'value' });
  });

  it('should have inputSchema as z.unknown() to accept any input', () => {
    const mastra = createMockMastra();
    const def: WorkflowStepDef = {
      type: 'workflow',
      workflowId: 'nested-workflow',
      input: {},
    };

    const step = resolveWorkflowStep(mastra, 'workflow-step', def);

    // Should accept any value - actual input extraction is done via $ref evaluation
    expect(step.inputSchema.parse({ __context: { key: 'value' }, extra: 123 })).toEqual({
      __context: { key: 'value' },
      extra: 123,
    });
    expect(step.inputSchema.parse('string')).toBe('string');
    expect(step.inputSchema.parse(null)).toBe(null);
  });
});

describe('resolveTransformStep', () => {
  it('should create a step with correct id', () => {
    const def: TransformStepDef = {
      type: 'transform',
      output: { result: { $ref: 'input.value' } },
      outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
    };

    const step = resolveTransformStep('my-transform-step', def);

    expect(step.id).toBe('my-transform-step');
    expect(step.description).toBe('Transform step');
  });

  it('should have output schema from definition', () => {
    const def: TransformStepDef = {
      type: 'transform',
      output: { name: { $literal: 'test' } },
      outputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          count: { type: 'integer' },
        },
        required: ['name'],
      },
    };

    const step = resolveTransformStep('transform-step', def);

    // Should validate against the provided schema
    expect(step.outputSchema.parse({ name: 'test' })).toEqual({ name: 'test' });
    expect(step.outputSchema.parse({ name: 'test', count: 5 })).toEqual({ name: 'test', count: 5 });
  });

  it('should execute and return mapped values', async () => {
    const def: TransformStepDef = {
      type: 'transform',
      output: {
        greeting: { $literal: 'hello' },
        constant: { $literal: 42 },
      },
      outputSchema: {
        type: 'object',
        properties: {
          greeting: { type: 'string' },
          constant: { type: 'integer' },
        },
      },
    };

    const step = resolveTransformStep('transform-step', def);

    // Execute with minimal params
    const result = await step.execute({
      getInitData: () => ({}),
      getStepResult: () => null,
      state: {},
      setState: vi.fn(),
    } as any);

    expect(result).toEqual({
      greeting: 'hello',
      constant: 42,
    });
  });

  it('should handle state updates when stateUpdates is defined', async () => {
    const setStateMock = vi.fn();
    const def: TransformStepDef = {
      type: 'transform',
      output: { value: { $literal: 'output' } },
      outputSchema: { type: 'object', properties: { value: { type: 'string' } } },
      stateUpdates: { counter: { $literal: 10 } },
    };

    const step = resolveTransformStep('transform-step', def);

    await step.execute({
      getInitData: () => ({}),
      getStepResult: () => null,
      state: { existing: 'value' },
      setState: setStateMock,
    } as any);

    expect(setStateMock).toHaveBeenCalledWith({
      existing: 'value',
      counter: 10,
    });
  });
});

describe('resolveSuspendStep', () => {
  it('should create a step with correct id', () => {
    const def: SuspendStepDef = {
      type: 'suspend',
      resumeSchema: { type: 'object', properties: { approval: { type: 'boolean' } } },
    };

    const step = resolveSuspendStep('my-suspend-step', def);

    expect(step.id).toBe('my-suspend-step');
    expect(step.description).toBe('Suspend step - waiting for external input');
  });

  it('should have resumeSchema set', () => {
    const def: SuspendStepDef = {
      type: 'suspend',
      resumeSchema: {
        type: 'object',
        properties: {
          approved: { type: 'boolean' },
          reason: { type: 'string' },
        },
        required: ['approved'],
      },
    };

    const step = resolveSuspendStep('suspend-step', def);

    expect(step.resumeSchema).toBeDefined();
    expect(step.resumeSchema!.parse({ approved: true })).toEqual({ approved: true });
    expect(step.resumeSchema!.parse({ approved: false, reason: 'test' })).toEqual({
      approved: false,
      reason: 'test',
    });
  });

  it('should return resumeData when provided', async () => {
    const def: SuspendStepDef = {
      type: 'suspend',
      resumeSchema: { type: 'object', properties: { data: { type: 'string' } } },
    };

    const step = resolveSuspendStep('suspend-step', def);
    const resumeData = { data: 'resumed-value' };

    const result = await step.execute({
      resumeData,
      suspend: vi.fn(),
      getInitData: () => ({}),
      getStepResult: () => null,
    } as any);

    expect(result).toEqual(resumeData);
  });

  it('should call suspend with payload when no resumeData', async () => {
    const suspendMock = vi.fn().mockReturnValue('suspended');
    const def: SuspendStepDef = {
      type: 'suspend',
      resumeSchema: { type: 'object' },
      payload: { message: { $literal: 'waiting for approval' } },
    };

    const step = resolveSuspendStep('suspend-step', def);

    const result = await step.execute({
      resumeData: undefined,
      suspend: suspendMock,
      getInitData: () => ({}),
      getStepResult: () => null,
    } as any);

    expect(suspendMock).toHaveBeenCalledWith({ message: 'waiting for approval' });
    expect(result).toBe('suspended');
  });
});

describe('resolveStep (main function)', () => {
  it('should route agent type to resolveAgentStep', () => {
    const mastra = createMockMastra();
    const def: DeclarativeStepDefinition = {
      type: 'agent',
      agentId: 'test-agent',
      input: { prompt: { $ref: 'input.text' } },
    };

    const step = resolveStep(mastra, 'test-step', def);

    expect(step.id).toBe('test-step');
    expect(step.description).toContain('Agent step');
  });

  it('should route tool type to resolveToolStep', () => {
    const mastra = createMockMastra();
    const def: DeclarativeStepDefinition = {
      type: 'tool',
      toolId: 'test-tool',
      input: {},
    };

    const step = resolveStep(mastra, 'test-step', def);

    expect(step.id).toBe('test-step');
    expect(step.description).toContain('Tool step');
  });

  it('should route workflow type to resolveWorkflowStep', () => {
    const mastra = createMockMastra();
    const def: DeclarativeStepDefinition = {
      type: 'workflow',
      workflowId: 'nested-wf',
      input: {},
    };

    const step = resolveStep(mastra, 'test-step', def);

    expect(step.id).toBe('test-step');
    expect(step.description).toContain('Workflow step');
  });

  it('should route transform type to resolveTransformStep', () => {
    const mastra = createMockMastra();
    const def: DeclarativeStepDefinition = {
      type: 'transform',
      output: {},
      outputSchema: { type: 'object' },
    };

    const step = resolveStep(mastra, 'test-step', def);

    expect(step.id).toBe('test-step');
    expect(step.description).toBe('Transform step');
  });

  it('should route suspend type to resolveSuspendStep', () => {
    const mastra = createMockMastra();
    const def: DeclarativeStepDefinition = {
      type: 'suspend',
      resumeSchema: { type: 'object' },
    };

    const step = resolveStep(mastra, 'test-step', def);

    expect(step.id).toBe('test-step');
    expect(step.description).toContain('Suspend step');
  });

  it('should throw on unknown step type', () => {
    const mastra = createMockMastra();
    const def = { type: 'unknown-type' } as any;

    expect(() => resolveStep(mastra, 'test-step', def)).toThrow('Unknown step type: unknown-type');
  });
});

describe('isVariableRef', () => {
  it('should return true for objects with $ref property', () => {
    expect(isVariableRef({ $ref: 'input.value' })).toBe(true);
    expect(isVariableRef({ $ref: 'steps.step1.output' })).toBe(true);
    expect(isVariableRef({ $ref: '' })).toBe(true);
  });

  it('should return false for objects without $ref property', () => {
    expect(isVariableRef({ $literal: 'value' })).toBe(false);
    expect(isVariableRef({ other: 'prop' })).toBe(false);
    expect(isVariableRef({})).toBe(false);
  });

  it('should return false for non-objects', () => {
    expect(isVariableRef(null)).toBe(false);
    expect(isVariableRef(undefined)).toBe(false);
    expect(isVariableRef('string')).toBe(false);
    expect(isVariableRef(123)).toBe(false);
    expect(isVariableRef(true)).toBe(false);
    expect(isVariableRef(['array'])).toBe(false);
  });
});
