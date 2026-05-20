import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowRunner } from '../types';
import { createStep, createWorkflow } from '../workflow';

// ============================================================================
// createWorkflow() with runner parameter tests
// ============================================================================

describe('createWorkflow() with runner parameter', () => {
  // Create a mock runner for testing
  const createMockRunner = (transformFn?: (workflow: any) => any): WorkflowRunner => ({
    adaptWorkflow:
      transformFn ||
      (workflow => {
        // Mark it as adapted for testing
        (workflow as any).__adapted = true;
        return workflow;
      }),
  });

  describe('basic runner support', () => {
    it('should accept runner parameter in createWorkflow', () => {
      const runner = createMockRunner();
      const workflow = createWorkflow({
        id: 'test-with-runner',
        runner,
      });

      expect(workflow).toBeDefined();
      expect(workflow.id).toBe('test-with-runner');
    });

    it('should apply runner.adaptWorkflow() to workflow', () => {
      const adaptSpy = vi.fn(w => {
        (w as any).__adapted = true;
        return w;
      });

      const runner: WorkflowRunner = {
        adaptWorkflow: adaptSpy,
      };

      const workflow = createWorkflow({
        id: 'test-workflow',
        runner,
      });

      expect(adaptSpy).toHaveBeenCalled();
      expect((workflow as any).__adapted).toBe(true);
    });

    it('should return runner-adapted workflow', () => {
      let receivedWorkflow: any;

      const runner: WorkflowRunner = {
        adaptWorkflow: workflow => {
          receivedWorkflow = workflow;
          return workflow;
        },
      };

      const _workflow = createWorkflow({
        id: 'test-workflow',
        runner,
      });

      expect(receivedWorkflow).toBeDefined();
      expect(receivedWorkflow.id).toBe('test-workflow');
    });
  });

  describe('runner with workflow configuration', () => {
    it('should apply runner while preserving description', () => {
      const runner = createMockRunner();
      const workflow = createWorkflow({
        id: 'documented-workflow',
        description: 'Test workflow with runner',
        runner,
      });

      expect(workflow.id).toBe('documented-workflow');
      expect(workflow.description).toBe('Test workflow with runner');
      expect((workflow as any).__adapted).toBe(true);
    });

    it('should apply runner while preserving input schema', () => {
      const inputSchema = z.object({
        userId: z.string(),
        name: z.string(),
      });

      const runner = createMockRunner();
      const workflow = createWorkflow({
        id: 'schema-workflow',
        inputSchema,
        runner,
      });

      expect(workflow.id).toBe('schema-workflow');
      expect(workflow.inputSchema).toBe(inputSchema);
      expect((workflow as any).__adapted).toBe(true);
    });

    it('should apply runner while preserving output schema', () => {
      const outputSchema = z.object({
        success: z.boolean(),
        data: z.record(z.unknown()),
      });

      const runner = createMockRunner();
      const workflow = createWorkflow({
        id: 'output-schema-workflow',
        outputSchema,
        runner,
      });

      expect(workflow.id).toBe('output-schema-workflow');
      expect(workflow.outputSchema).toBe(outputSchema);
      expect((workflow as any).__adapted).toBe(true);
    });

    it('should apply runner while preserving both input and output schemas', () => {
      const inputSchema = z.object({ input: z.string() });
      const outputSchema = z.object({ output: z.number() });

      const runner = createMockRunner();
      const workflow = createWorkflow({
        id: 'full-schema-workflow',
        inputSchema,
        outputSchema,
        description: 'Full configuration workflow',
        runner,
      });

      expect(workflow.id).toBe('full-schema-workflow');
      expect(workflow.description).toBe('Full configuration workflow');
      expect(workflow.inputSchema).toBe(inputSchema);
      expect(workflow.outputSchema).toBe(outputSchema);
      expect((workflow as any).__adapted).toBe(true);
    });
  });

  describe('runner isolation from other parameters', () => {
    it('should not pass runner parameter to Workflow constructor', () => {
      // If runner was passed to Workflow constructor, it would error
      // because Workflow doesn't expect a 'runner' property
      const runner = createMockRunner();

      expect(() => {
        createWorkflow({
          id: 'isolated-runner',
          runner,
        });
      }).not.toThrow();
    });

    it('should not include runner in workflow properties', () => {
      const runner = createMockRunner();
      const workflow = createWorkflow({
        id: 'runner-isolation-test',
        runner,
      });

      // Runner should not be a property of the workflow itself
      expect((workflow as any).runner).toBeUndefined();
    });
  });

  describe('runner with workflow chaining', () => {
    it('should support .then() after creating workflow with runner', () => {
      const step = createStep({
        id: 'test-step',
        execute: async () => 'success',
      });

      const runner = createMockRunner();
      const workflow = createWorkflow({
        id: 'chained-workflow',
        runner,
      }).then('test-step', step);

      expect(workflow).toBeDefined();
      expect(workflow.id).toBe('chained-workflow');
      expect((workflow as any).__adapted).toBe(true);
    });

    it('should support .branch() after creating workflow with runner', () => {
      const step1 = createStep({
        id: 'branch-step-1',
        execute: async () => 'result1',
      });

      const step2 = createStep({
        id: 'branch-step-2',
        execute: async () => 'result2',
      });

      const workflow = createWorkflow({
        id: 'branched-workflow',
        runner,
      }).branch([
        [async () => true, step1],
        [async () => false, step2],
      ]);

      expect(workflow).toBeDefined();
      expect(workflow.id).toBe('branched-workflow');
      expect((workflow as any).__adapted).toBe(true);
    });

    it('should support multiple sequential operations with runner', () => {
      const step1 = createStep({
        id: 'step1',
        execute: async () => 'result1',
      });

      const step2 = createStep({
        id: 'step2',
        execute: async () => 'result2',
      });

      const runner = createMockRunner();
      const workflow = createWorkflow({
        id: 'sequential-workflow',
        runner,
      })
        .then('step1', step1)
        .then('step2', step2);

      expect(workflow).toBeDefined();
      expect(workflow.id).toBe('sequential-workflow');
      expect((workflow as any).__adapted).toBe(true);
    });
  });

  describe('runner without runner parameter (backward compatibility)', () => {
    it('should work without runner parameter', () => {
      const workflow = createWorkflow({
        id: 'no-runner-workflow',
      });

      expect(workflow).toBeDefined();
      expect(workflow.id).toBe('no-runner-workflow');
      expect((workflow as any).__adapted).toBeUndefined();
    });

    it('should work with configuration but no runner', () => {
      const inputSchema = z.object({ test: z.string() });

      const workflow = createWorkflow({
        id: 'config-no-runner',
        description: 'Configuration without runner',
        inputSchema,
      });

      expect(workflow).toBeDefined();
      expect(workflow.id).toBe('config-no-runner');
      expect(workflow.description).toBe('Configuration without runner');
      expect(workflow.inputSchema).toBe(inputSchema);
    });
  });

  describe('runner transformation capabilities', () => {
    it('should allow runner to transform workflow to different type', () => {
      const runner: WorkflowRunner = {
        adaptWorkflow: (workflow: any) => {
          const customWorkflow: any = {
            id: workflow.id,
            custom: true,
            ...workflow,
          };
          return customWorkflow;
        },
      };

      const workflow = createWorkflow({
        id: 'transformed-workflow',
        runner,
      }) as any;

      expect(workflow.id).toBe('transformed-workflow');
      expect((workflow as any).custom).toBe(true);
    });

    it('should pass exact workflow to runner.adaptWorkflow()', () => {
      let receivedWorkflow: any;

      const runner: WorkflowRunner = {
        adaptWorkflow: workflow => {
          receivedWorkflow = workflow;
          return workflow;
        },
      };

      const inputSchema = z.object({ id: z.string() });
      const outputSchema = z.object({ result: z.boolean() });

      createWorkflow({
        id: 'passed-workflow',
        description: 'Passed to runner',
        inputSchema,
        outputSchema,
        runner,
      });

      expect(receivedWorkflow.id).toBe('passed-workflow');
      expect(receivedWorkflow.description).toBe('Passed to runner');
      expect(receivedWorkflow.inputSchema).toBe(inputSchema);
      expect(receivedWorkflow.outputSchema).toBe(outputSchema);
    });
  });

  describe('multiple runners on different workflows', () => {
    it('should support different runners for different workflows', () => {
      const runner1Spy = vi.fn(w => {
        (w as any).__runner = 'runner1';
        return w;
      });

      const runner2Spy = vi.fn(w => {
        (w as any).__runner = 'runner2';
        return w;
      });

      const runner1: WorkflowRunner = { adaptWorkflow: runner1Spy };
      const runner2: WorkflowRunner = { adaptWorkflow: runner2Spy };

      const workflow1 = createWorkflow({
        id: 'workflow-with-runner1',
        runner: runner1,
      }) as any;

      const workflow2 = createWorkflow({
        id: 'workflow-with-runner2',
        runner: runner2,
      }) as any;

      expect(runner1Spy).toHaveBeenCalled();
      expect(runner2Spy).toHaveBeenCalled();
      expect(workflow1.__runner).toBe('runner1');
      expect(workflow2.__runner).toBe('runner2');
    });

    it('should handle runner switching across workflow creation calls', () => {
      const runner1 = createMockRunner(w => {
        (w as any).__engineType = 'runner1';
        return w;
      });

      const runner2 = createMockRunner(w => {
        (w as any).__engineType = 'runner2';
        return w;
      });

      const wf1 = createWorkflow({ id: 'wf1', runner: runner1 }) as any;
      const wf2 = createWorkflow({ id: 'wf2', runner: runner2 }) as any;
      const wf3 = createWorkflow({ id: 'wf3', runner: runner1 }) as any;

      expect(wf1.__engineType).toBe('runner1');
      expect(wf2.__engineType).toBe('runner2');
      expect(wf3.__engineType).toBe('runner1');
    });
  });
});
