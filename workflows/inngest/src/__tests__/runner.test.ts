import { createStep, createWorkflow } from '@mastra/core/workflows';
import { Inngest } from 'inngest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { InngestRunner, createInngestRunner } from '../runner';
import type { InngestWorkflow } from '../workflow';

// ============================================================================
// InngestRunner Tests
// ============================================================================

describe('InngestRunner', () => {
  const inngest = new Inngest({ id: 'test-app' });

  describe('constructor', () => {
    it('should create an InngestRunner with default options', () => {
      const runner = new InngestRunner({ inngest });
      expect(runner).toBeDefined();
      expect(runner).toBeInstanceOf(InngestRunner);
    });

    it('should create an InngestRunner with concurrency options', () => {
      const runner = new InngestRunner({
        inngest,
        concurrency: {
          limit: 10,
        },
      });
      expect(runner).toBeDefined();
    });

    it('should create an InngestRunner with rate limit options', () => {
      const runner = new InngestRunner({
        inngest,
        rateLimit: {
          limit: 5,
          period: '1h',
        },
      });
      expect(runner).toBeDefined();
    });

    it('should create an InngestRunner with priority option', () => {
      const runner = new InngestRunner({
        inngest,
        priority: {
          run: -1,
        },
      });
      expect(runner).toBeDefined();
    });

    it('should create an InngestRunner with throttle option', () => {
      const runner = new InngestRunner({
        inngest,
        throttle: {
          limit: 3,
          period: '10s',
          key: 'user_id',
        },
      });
      expect(runner).toBeDefined();
    });

    it('should create an InngestRunner with debounce option', () => {
      const runner = new InngestRunner({
        inngest,
        debounce: {
          limit: 1,
          period: '5m',
          key: 'workflow_id',
        },
      });
      expect(runner).toBeDefined();
    });

    it('should create an InngestRunner with multiple options combined', () => {
      const runner = new InngestRunner({
        inngest,
        concurrency: { limit: 10 },
        rateLimit: { limit: 5, period: '1h' },
        priority: { run: -1 },
        throttle: { limit: 3, period: '10s', key: 'user_id' },
      });
      expect(runner).toBeDefined();
    });
  });

  describe('adaptWorkflow', () => {
    it('should adapt a standard workflow to an InngestWorkflow', () => {
      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const runner = createInngestRunner({ inngest });
      const adapted = runner.adaptWorkflow(workflow);

      expect(adapted).toBeDefined();
      expect(adapted.id).toBe('test-workflow');
      expect((adapted as InngestWorkflow).inngest).toBe(inngest);
    });

    it('should preserve workflow ID when adapting', () => {
      const workflow = createWorkflow({
        id: 'my-unique-id',
      });

      const runner = createInngestRunner({ inngest });
      const adapted = runner.adaptWorkflow(workflow);

      expect(adapted.id).toBe('my-unique-id');
    });

    it('should preserve workflow description when adapting', () => {
      const workflow = createWorkflow({
        id: 'test-workflow',
        description: 'A test workflow',
      });

      const runner = createInngestRunner({ inngest });
      const adapted = runner.adaptWorkflow(workflow);

      expect(adapted.description).toBe('A test workflow');
    });

    it('should preserve workflow schemas when adapting', () => {
      const inputSchema = z.object({ input: z.string() });
      const outputSchema = z.object({ output: z.number() });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema,
        outputSchema,
      });

      const runner = createInngestRunner({ inngest });
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

      const runner = createInngestRunner({ inngest });
      const adapted = runner.adaptWorkflow(workflow);

      // Verify that the adapted workflow has the same step graph
      expect((adapted as any).stepGraph).toBeDefined();
    });

    it('should preserve committed state when adapting', () => {
      const workflow = createWorkflow({
        id: 'test-workflow',
      });

      workflow.commit();

      const runner = createInngestRunner({ inngest });
      const adapted = runner.adaptWorkflow(workflow);

      expect((adapted as any).committed).toBe(true);
    });

    it('should apply flow control options to adapted workflow', () => {
      const workflow = createWorkflow({
        id: 'test-workflow',
      });

      const runner = createInngestRunner({
        inngest,
        concurrency: { limit: 5 },
        rateLimit: { limit: 10, period: '1h' },
      });

      const adapted = runner.adaptWorkflow(workflow);

      // The adapted workflow should have access to the Inngest instance
      expect((adapted as InngestWorkflow).inngest).toBe(inngest);
    });

    it('should handle workflows with no schemas', () => {
      const workflow = createWorkflow({
        id: 'test-workflow',
        // No schemas defined
      });

      const runner = createInngestRunner({ inngest });
      const adapted = runner.adaptWorkflow(workflow);

      expect(adapted).toBeDefined();
      expect(adapted.id).toBe('test-workflow');
    });

    it('should handle workflows with description and no schemas', () => {
      const workflow = createWorkflow({
        id: 'test-workflow',
        description: 'A test workflow with description',
      });

      const runner = createInngestRunner({ inngest });
      const adapted = runner.adaptWorkflow(workflow);

      expect(adapted.id).toBe('test-workflow');
      expect(adapted.description).toBe('A test workflow with description');
    });
  });
});

describe('createInngestRunner', () => {
  it('should create an InngestRunner factory function', () => {
    const inngest = new Inngest({ id: 'test-app' });
    const runner = createInngestRunner({ inngest });

    expect(runner).toBeInstanceOf(InngestRunner);
  });

  it('should pass options through to the InngestRunner constructor', () => {
    const inngest = new Inngest({ id: 'test-app' });
    const runner = createInngestRunner({
      inngest,
      concurrency: { limit: 10 },
      rateLimit: { limit: 5, period: '1h' },
    });

    expect(runner).toBeInstanceOf(InngestRunner);
  });

  it('should create multiple independent runners', () => {
    const inngest1 = new Inngest({ id: 'app1' });
    const inngest2 = new Inngest({ id: 'app2' });

    const runner1 = createInngestRunner({ inngest: inngest1 });
    const runner2 = createInngestRunner({ inngest: inngest2 });

    expect(runner1).not.toBe(runner2);
    expect((runner1 as any).inngest).toBe(inngest1);
    expect((runner2 as any).inngest).toBe(inngest2);
  });
});

describe('runner with createWorkflow integration', () => {
  it('should create a workflow with runner in a single call', () => {
    const inngest = new Inngest({ id: 'test-app' });
    const runner = createInngestRunner({ inngest });

    const workflow = createWorkflow({
      id: 'integrated-workflow',
      runner,
    });

    expect(workflow).toBeDefined();
    expect(workflow.id).toBe('integrated-workflow');
    expect((workflow as InngestWorkflow).inngest).toBe(inngest);
  });

  it('should preserve workflow configuration when using runner', () => {
    const inngest = new Inngest({ id: 'test-app' });
    const runner = createInngestRunner({
      inngest,
      concurrency: { limit: 5 },
    });

    const inputSchema = z.object({ data: z.string() });
    const outputSchema = z.object({ result: z.string() });

    const workflow = createWorkflow({
      id: 'configured-workflow',
      description: 'A workflow with full configuration',
      inputSchema,
      outputSchema,
      runner,
    });

    expect(workflow.id).toBe('configured-workflow');
    expect(workflow.description).toBe('A workflow with full configuration');
    expect(workflow.inputSchema).toBe(inputSchema);
    expect(workflow.outputSchema).toBe(outputSchema);
    expect((workflow as InngestWorkflow).inngest).toBe(inngest);
  });

  it('should allow chaining .then() after creating workflow with runner', () => {
    const inngest = new Inngest({ id: 'test-app' });
    const runner = createInngestRunner({ inngest });

    const step = createStep({
      id: 'test-step',
      execute: async () => 'test-result',
    });

    const workflow = createWorkflow({
      id: 'chained-workflow',
      runner,
    }).then('test-step', step);

    expect(workflow).toBeDefined();
    expect((workflow as InngestWorkflow).inngest).toBe(inngest);
  });

  it('should support multiple runners for different workflows', () => {
    const inngest = new Inngest({ id: 'test-app' });
    const runner1 = createInngestRunner({ inngest, concurrency: { limit: 5 } });
    const runner2 = createInngestRunner({ inngest, concurrency: { limit: 10 } });

    const workflow1 = createWorkflow({
      id: 'workflow-1',
      runner: runner1,
    });

    const workflow2 = createWorkflow({
      id: 'workflow-2',
      runner: runner2,
    });

    expect(workflow1.id).toBe('workflow-1');
    expect(workflow2.id).toBe('workflow-2');
    expect((workflow1 as InngestWorkflow).inngest).toBe(inngest);
    expect((workflow2 as InngestWorkflow).inngest).toBe(inngest);
  });
});
