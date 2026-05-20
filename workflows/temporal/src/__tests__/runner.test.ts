import { createStep, createWorkflow } from '@mastra/core/workflows';
import type { WorkflowClient } from '@temporalio/client';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { TemporalRunner, createTemporalRunner } from '../runner';
import type { TemporalWorkflow } from '../workflow';

// ============================================================================
// TemporalRunner Tests
// ============================================================================

describe('TemporalRunner', () => {
  // Mock Temporal client for testing
  const mockTemporalClient = {
    // This is a simplified mock for testing purposes
    connection: undefined,
  } as unknown as WorkflowClient;

  describe('constructor', () => {
    it('should create a TemporalRunner with required options', () => {
      const runner = new TemporalRunner({
        client: mockTemporalClient,
        taskQueue: 'default',
      });
      expect(runner).toBeDefined();
      expect(runner).toBeInstanceOf(TemporalRunner);
    });

    it('should create a TemporalRunner with startToCloseTimeout', () => {
      const runner = new TemporalRunner({
        client: mockTemporalClient,
        taskQueue: 'custom-queue',
        startToCloseTimeout: '10m',
      });
      expect(runner).toBeDefined();
    });

    it('should create a TemporalRunner with retry policy', () => {
      const runner = new TemporalRunner({
        client: mockTemporalClient,
        taskQueue: 'default',
        startToCloseTimeout: '5m',
      });
      expect(runner).toBeDefined();
    });
  });

  describe('adaptWorkflow', () => {
    it('should adapt a standard workflow to a TemporalWorkflow', () => {
      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const runner = createTemporalRunner({
        client: mockTemporalClient,
        taskQueue: 'default',
      });

      const adapted = runner.adaptWorkflow(workflow);

      expect(adapted).toBeDefined();
      expect(adapted.id).toBe('test-workflow');
      expect((adapted as TemporalWorkflow).client).toBe(mockTemporalClient);
      expect((adapted as TemporalWorkflow).taskQueue).toBe('default');
    });

    it('should preserve workflow ID when adapting', () => {
      const workflow = createWorkflow({
        id: 'temporal-test-id',
      });

      const runner = createTemporalRunner({
        client: mockTemporalClient,
        taskQueue: 'default',
      });

      const adapted = runner.adaptWorkflow(workflow);

      expect(adapted.id).toBe('temporal-test-id');
    });

    it('should preserve workflow description when adapting', () => {
      const workflow = createWorkflow({
        id: 'test-workflow',
        description: 'Temporal workflow test',
      });

      const runner = createTemporalRunner({
        client: mockTemporalClient,
        taskQueue: 'default',
      });

      const adapted = runner.adaptWorkflow(workflow);

      expect(adapted.description).toBe('Temporal workflow test');
    });

    it('should preserve workflow schemas when adapting', () => {
      const inputSchema = z.object({ input: z.string() });
      const outputSchema = z.object({ output: z.number() });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema,
        outputSchema,
      });

      const runner = createTemporalRunner({
        client: mockTemporalClient,
        taskQueue: 'default',
      });

      const adapted = runner.adaptWorkflow(workflow);

      expect(adapted.inputSchema).toBe(inputSchema);
      expect(adapted.outputSchema).toBe(outputSchema);
    });

    it('should preserve step graph when adapting', () => {
      const step1 = createStep({
        id: 'step1',
        execute: async () => 'result1',
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
      });

      workflow.then('step1', step1);

      const runner = createTemporalRunner({
        client: mockTemporalClient,
        taskQueue: 'default',
      });

      const adapted = runner.adaptWorkflow(workflow);

      // Verify that the adapted workflow has the same step graph
      expect((adapted as any).stepGraph).toBeDefined();
    });

    it('should preserve committed state when adapting', () => {
      const workflow = createWorkflow({
        id: 'test-workflow',
      });

      workflow.commit();

      const runner = createTemporalRunner({
        client: mockTemporalClient,
        taskQueue: 'default',
      });

      const adapted = runner.adaptWorkflow(workflow);

      expect((adapted as any).committed).toBe(true);
    });

    it('should apply Temporal options to adapted workflow', () => {
      const workflow = createWorkflow({
        id: 'test-workflow',
      });

      const runner = createTemporalRunner({
        client: mockTemporalClient,
        taskQueue: 'custom-queue',
        startToCloseTimeout: '15m',
      });

      const adapted = runner.adaptWorkflow(workflow);

      expect((adapted as TemporalWorkflow).client).toBe(mockTemporalClient);
      expect((adapted as TemporalWorkflow).taskQueue).toBe('custom-queue');
    });

    it('should handle workflows with no schemas', () => {
      const workflow = createWorkflow({
        id: 'test-workflow',
      });

      const runner = createTemporalRunner({
        client: mockTemporalClient,
        taskQueue: 'default',
      });

      const adapted = runner.adaptWorkflow(workflow);

      expect(adapted).toBeDefined();
      expect(adapted.id).toBe('test-workflow');
    });

    it('should handle workflows with description and no schemas', () => {
      const workflow = createWorkflow({
        id: 'test-workflow',
        description: 'A test workflow with description',
      });

      const runner = createTemporalRunner({
        client: mockTemporalClient,
        taskQueue: 'default',
      });

      const adapted = runner.adaptWorkflow(workflow);

      expect(adapted.id).toBe('test-workflow');
      expect(adapted.description).toBe('A test workflow with description');
    });
  });
});

describe('createTemporalRunner', () => {
  const mockTemporalClient = {} as unknown as WorkflowClient;

  it('should create a TemporalRunner with factory function', () => {
    const runner = createTemporalRunner({
      client: mockTemporalClient,
      taskQueue: 'default',
    });

    expect(runner).toBeInstanceOf(TemporalRunner);
  });

  it('should pass options through to the TemporalRunner constructor', () => {
    const runner = createTemporalRunner({
      client: mockTemporalClient,
      taskQueue: 'custom-queue',
      startToCloseTimeout: '10m',
    });

    expect(runner).toBeInstanceOf(TemporalRunner);
    expect((runner as any).taskQueue).toBe('custom-queue');
  });

  it('should create multiple independent runners', () => {
    const mockClient1 = {} as unknown as WorkflowClient;
    const mockClient2 = {} as unknown as WorkflowClient;

    const runner1 = createTemporalRunner({
      client: mockClient1,
      taskQueue: 'queue1',
    });

    const runner2 = createTemporalRunner({
      client: mockClient2,
      taskQueue: 'queue2',
    });

    expect(runner1).not.toBe(runner2);
    expect((runner1 as any).client).toBe(mockClient1);
    expect((runner2 as any).client).toBe(mockClient2);
  });
});

describe('runner with createWorkflow integration', () => {
  const mockTemporalClient = {} as unknown as WorkflowClient;

  it('should create a workflow with runner in a single call', () => {
    const runner = createTemporalRunner({
      client: mockTemporalClient,
      taskQueue: 'default',
    });

    const workflow = createWorkflow({
      id: 'integrated-temporal-workflow',
      runner,
    });

    expect(workflow).toBeDefined();
    expect(workflow.id).toBe('integrated-temporal-workflow');
    expect((workflow as TemporalWorkflow).client).toBe(mockTemporalClient);
  });

  it('should preserve workflow configuration when using runner', () => {
    const runner = createTemporalRunner({
      client: mockTemporalClient,
      taskQueue: 'configured-queue',
      startToCloseTimeout: '20m',
    });

    const inputSchema = z.object({ data: z.string() });
    const outputSchema = z.object({ result: z.string() });

    const workflow = createWorkflow({
      id: 'configured-temporal-workflow',
      description: 'A temporal workflow with full configuration',
      inputSchema,
      outputSchema,
      runner,
    });

    expect(workflow.id).toBe('configured-temporal-workflow');
    expect(workflow.description).toBe('A temporal workflow with full configuration');
    expect(workflow.inputSchema).toBe(inputSchema);
    expect(workflow.outputSchema).toBe(outputSchema);
    expect((workflow as TemporalWorkflow).client).toBe(mockTemporalClient);
  });

  it('should allow chaining .then() after creating workflow with runner', () => {
    const runner = createTemporalRunner({
      client: mockTemporalClient,
      taskQueue: 'default',
    });

    const step = createStep({
      id: 'temporal-step',
      execute: async () => 'temporal-result',
    });

    const workflow = createWorkflow({
      id: 'chained-temporal-workflow',
      runner,
    }).then('temporal-step', step);

    expect(workflow).toBeDefined();
    expect((workflow as TemporalWorkflow).client).toBe(mockTemporalClient);
  });

  it('should support multiple runners for different workflows', () => {
    const mockClient = {} as unknown as WorkflowClient;

    const runner1 = createTemporalRunner({
      client: mockClient,
      taskQueue: 'queue1',
    });

    const runner2 = createTemporalRunner({
      client: mockClient,
      taskQueue: 'queue2',
    });

    const workflow1 = createWorkflow({
      id: 'temporal-workflow-1',
      runner: runner1,
    });

    const workflow2 = createWorkflow({
      id: 'temporal-workflow-2',
      runner: runner2,
    });

    expect(workflow1.id).toBe('temporal-workflow-1');
    expect(workflow2.id).toBe('temporal-workflow-2');
    expect((workflow1 as TemporalWorkflow).taskQueue).toBe('queue1');
    expect((workflow2 as TemporalWorkflow).taskQueue).toBe('queue2');
  });

  it('should support different Temporal configurations', () => {
    const mockClient = {} as unknown as WorkflowClient;

    const runner = createTemporalRunner({
      client: mockClient,
      taskQueue: 'default',
      startToCloseTimeout: '5m',
    });

    const workflow = createWorkflow({
      id: 'configured-temporal',
      runner,
    });

    expect((workflow as TemporalWorkflow).client).toBe(mockClient);
    expect((workflow as TemporalWorkflow).taskQueue).toBe('default');
  });
});
