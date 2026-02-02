import { serve } from '@hono/node-server';
import { realtimeMiddleware } from '@inngest/realtime/middleware';
import { Agent } from '@mastra/core/agent';
import { MastraError } from '@mastra/core/error';
import { Mastra } from '@mastra/core/mastra';
import {
  MastraLanguageModelV2Mock as MockLanguageModelV2,
  simulateReadableStream,
} from '@mastra/core/test-utils/llm-mock';
import type { StreamEvent } from '@mastra/core/workflows';
import { createHonoServer } from '@mastra/deployer/server';
import { DefaultStorage } from '@mastra/libsql';
import { $ } from 'execa';
import { Inngest } from 'inngest';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { z } from 'zod';
import { init, serve as inngestServe } from './index';

interface LocalTestContext {
  inngestPort: number;
  handlerPort: number;
  srv?: any;
}

async function resetInngest() {
  await new Promise(resolve => setTimeout(resolve, 1000));
  await $`docker compose restart`;
  await new Promise(resolve => setTimeout(resolve, 1500));
}

/**
 * Inngest-specific tests
 *
 * These tests cover functionality specific to the Inngest workflow engine that is not
 * covered by the shared test suite in workflows/_test-utils/.
 *
 * Tests for general workflow behavior (basic execution, variable resolution, conditions,
 * loops, suspend/resume, callbacks, error handling, schema validation, retry, time travel,
 * nested workflows, etc.) are covered by the shared suite via workflow-factory.test.ts.
 */
describe('MastraInngestWorkflow', () => {
  let globServer: any;

  beforeEach<LocalTestContext>(async ctx => {
    ctx.inngestPort = 4000;
    ctx.handlerPort = 4001;

    globServer?.close();

    vi.restoreAllMocks();
  });

  describe('Inngest-specific: restart() throws error', () => {
    it('should throw error when restart is called on inngest workflow', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);
      const execute = vi.fn().mockResolvedValue({ result: 'success' });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
        }),
        steps: [step1],
      });
      workflow.then(step1).commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-workflow': workflow,
        },
        server: {
          apiRoutes: [
            {
              path: '/inngest/api',
              method: 'ALL',
              createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
            },
          ],
        },
      });

      const app = await createHonoServer(mastra);

      const srv = (globServer = serve({
        fetch: app.fetch,
        port: (ctx as any).handlerPort,
      }));
      await resetInngest();

      const run = await workflow.createRun();
      await expect(run.restart()).rejects.toThrowError('restart() is not supported on inngest workflows');

      srv.close();
    });
  });

  describe('Inngest-specific: waitForEvent deprecation', () => {
    it('should throw error if waitForEvent is used', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const execute = vi.fn().mockResolvedValue({ result: 'success' });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData, resumeData }) => {
          return { result: inputData.result, resumed: resumeData };
        },
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string(), resumed: z.any() }),
        resumeSchema: z.any(),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
          resumed: z.any(),
        }),
        steps: [step1],
      });

      try {
        // @ts-expect-error - testing dynamic workflow result - we expect this to throw an error
        workflow.then(step1).waitForEvent('hello-event', step2).commit();
      } catch (error) {
        expect(error).toBeInstanceOf(MastraError);
        expect(error).toHaveProperty(
          'message',
          'waitForEvent has been removed. Please use suspend & resume flow instead. See https://mastra.ai/en/docs/workflows/suspend-and-resume for more details.',
        );
      }
    });
  });

  describe('Inngest-specific: sleep steps', () => {
    it('should execute a sleep step', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const execute = vi.fn().mockResolvedValue({ result: 'success' });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          return { result: 'slept successfully: ' + inputData.result };
        },
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
        }),
        steps: [step1],
      });

      workflow.then(step1).sleep(1000).then(step2).commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-workflow': workflow,
        },
        server: {
          apiRoutes: [
            {
              path: '/inngest/api',
              method: 'ALL',
              createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
            },
          ],
        },
      });

      const app = await createHonoServer(mastra);

      const srv = (globServer = serve({
        fetch: app.fetch,
        port: (ctx as any).handlerPort,
      }));
      await resetInngest();

      const run = await workflow.createRun();
      const startTime = Date.now();
      const result = await run.start({ inputData: {} });
      const endTime = Date.now();

      expect(execute).toHaveBeenCalled();
      expect(result.steps['step1']).toMatchObject({
        status: 'success',
        output: { result: 'success' },
      });

      expect(result.steps['step2']).toMatchObject({
        status: 'success',
        output: { result: 'slept successfully: success' },
      });

      expect(endTime - startTime).toBeGreaterThan(1000);

      srv.close();
    });

    it('should execute a sleep step with fn parameter', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const execute = vi.fn().mockResolvedValue({ value: 1000 });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.number() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          return { value: inputData.value + 1000 };
        },
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          value: z.number(),
        }),
        steps: [step1],
      });

      workflow
        .then(step1)
        .sleep(async ({ inputData }) => {
          return inputData.value;
        })
        .then(step2)
        .commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-workflow': workflow,
        },
        server: {
          apiRoutes: [
            {
              path: '/inngest/api',
              method: 'ALL',
              createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
            },
          ],
        },
      });

      const app = await createHonoServer(mastra);

      const srv = (globServer = serve({
        fetch: app.fetch,
        port: (ctx as any).handlerPort,
      }));
      await resetInngest();

      const run = await workflow.createRun();
      const startTime = Date.now();
      const result = await run.start({ inputData: {} });
      const endTime = Date.now();

      expect(execute).toHaveBeenCalled();
      expect(result.steps['step1']).toMatchObject({
        status: 'success',
        output: { value: 1000 },
      });

      expect(result.steps['step2']).toMatchObject({
        status: 'success',
        output: { value: 2000 },
      });

      expect(endTime - startTime).toBeGreaterThan(1000);

      srv.close();
    });

    it('should execute a sleep until step', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const execute = vi.fn().mockResolvedValue({ result: 'success' });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          return { result: 'slept successfully: ' + inputData.result };
        },
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
        }),
        steps: [step1],
      });

      workflow
        .then(step1)
        .sleepUntil(new Date(Date.now() + 1000))
        .then(step2)
        .commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-workflow': workflow,
        },
        server: {
          apiRoutes: [
            {
              path: '/inngest/api',
              method: 'ALL',
              createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
            },
          ],
        },
      });

      const app = await createHonoServer(mastra);

      const srv = (globServer = serve({
        fetch: app.fetch,
        port: (ctx as any).handlerPort,
      }));
      await resetInngest();

      const run = await workflow.createRun();
      const startTime = Date.now();
      const result = await run.start({ inputData: {} });
      const endTime = Date.now();

      expect(execute).toHaveBeenCalled();
      expect(result.steps['step1']).toMatchObject({
        status: 'success',
        output: { result: 'success' },
      });

      expect(result.steps['step2']).toMatchObject({
        status: 'success',
        output: { result: 'slept successfully: success' },
      });

      expect(endTime - startTime).toBeGreaterThan(1000);

      srv.close();
    });

    it('should execute a sleep until step with fn parameter', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const execute = vi.fn().mockResolvedValue({ value: 1000 });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.number() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          return { value: inputData.value + 1000 };
        },
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          value: z.number(),
        }),
        steps: [step1],
      });

      workflow
        .then(step1)
        .sleepUntil(async ({ inputData }) => {
          return new Date(Date.now() + inputData.value);
        })
        .then(step2)
        .commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-workflow': workflow,
        },
        server: {
          apiRoutes: [
            {
              path: '/inngest/api',
              method: 'ALL',
              createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
            },
          ],
        },
      });

      const app = await createHonoServer(mastra);

      const srv = (globServer = serve({
        fetch: app.fetch,
        port: (ctx as any).handlerPort,
      }));
      await resetInngest();

      const run = await workflow.createRun();
      const startTime = Date.now();
      const result = await run.start({ inputData: {} });
      const endTime = Date.now();

      expect(execute).toHaveBeenCalled();
      expect(result.steps['step1']).toMatchObject({
        status: 'success',
        output: { value: 1000 },
      });

      expect(result.steps['step2']).toMatchObject({
        status: 'success',
        output: { value: 2000 },
      });

      expect(endTime - startTime).toBeGreaterThan(1000);

      srv.close();
    }, 50_000);
  });

  describe('Inngest-specific: abort with sleep', () => {
    it('should be able to abort workflow execution in between steps (during sleep)', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1 = createStep({
        id: 'step1',
        execute: async ({ inputData }) => {
          return { result: 'step1: ' + inputData.value };
        },
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          return { result: 'step2: ' + inputData.result };
        },
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
        }),
        steps: [step1, step2],
      });

      workflow.then(step1).sleep(2000).then(step2).commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-workflow': workflow,
        },
        server: {
          apiRoutes: [
            {
              path: '/inngest/api',
              method: 'ALL',
              createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
            },
          ],
        },
      });

      const app = await createHonoServer(mastra);

      const srv = (globServer = serve({
        fetch: app.fetch,
        port: (ctx as any).handlerPort,
      }));
      await resetInngest();

      const run = await workflow.createRun();
      const p = run.start({ inputData: { value: 'test' } });

      setTimeout(() => {
        run.cancel();
      }, 1000);

      const result = await p;

      srv.close();

      expect(result.status).toBe('canceled');
      expect(result.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'step1: test' },
        payload: { value: 'test' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(result.steps['step2']).toBeUndefined();
    });
  });

  describe('Inngest-specific: Access to inngest step primitives', () => {
    it('should inject inngest step primitives into steps during run', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const step = createStep({
        id: 'step1',
        execute: async ({ engine }) => {
          return {
            hasEngine: !!engine.step,
          };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          hasEngine: z.boolean(),
        }),
        options: { validateInputs: false },
      });
      workflow.then(step).commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-workflow': workflow,
        },
        server: {
          apiRoutes: [
            {
              path: '/inngest/api',
              method: 'ALL',
              createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
            },
          ],
        },
      });

      const app = await createHonoServer(mastra);

      const srv = (globServer = serve({
        fetch: app.fetch,
        port: (ctx as any).handlerPort,
      }));
      await resetInngest();

      const run = await workflow.createRun();
      const result = await run.start({});

      srv.close();

      // @ts-expect-error - testing dynamic workflow result
      expect(result?.steps.step1.output.hasEngine).toBe(true);
    });
  });

  describe.sequential('Inngest-specific: Long Running Steps', () => {
    it('should handle long-running steps with eventual consistency', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const childWorkflowStep = createStep({
        id: 'child-workflow-step',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async ({ inputData }) => inputData,
      });

      const childWorkflow = createWorkflow({
        id: 'child-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      })
        .then(childWorkflowStep)
        .commit();

      // Create a step that takes 30 seconds to complete
      const longRunningStep = createStep({
        id: 'long-running-step',
        execute: async () => {
          // Simulate a long-running operation (30 seconds)
          await new Promise(resolve => setTimeout(resolve, 30000));
          return { result: 'completed after 30 seconds' };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'long-running-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        steps: [childWorkflow, longRunningStep],
      });
      workflow.then(childWorkflow).then(longRunningStep).commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'long-running-workflow': workflow,
        },
        server: {
          apiRoutes: [
            {
              path: '/inngest/api',
              method: 'ALL',
              createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
            },
          ],
        },
      });

      const app = await createHonoServer(mastra);

      const srv = (globServer = serve({
        fetch: app.fetch,
        port: (ctx as any).handlerPort,
      }));

      await resetInngest();

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      srv.close();

      // Verify the workflow completed successfully with the correct output
      expect(result.status).toBe('success');
      expect(result.steps['long-running-step']).toEqual({
        status: 'success',
        output: { result: 'completed after 30 seconds' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
    }, 120000); // 2 minute timeout for the test
  });

  describe.sequential('Inngest-specific: Flow Control Configuration', () => {
    it('should accept workflow configuration with flow control properties', async ctx => {
      const inngest = new Inngest({
        id: 'mastra-flow-control',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1 = createStep({
        id: 'step1',
        execute: async ({ inputData }) => {
          return { result: 'step1: ' + inputData.value };
        },
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      // Test workflow with flow control configuration
      const workflow = createWorkflow({
        id: 'flow-control-test',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1],
        // Flow control properties
        concurrency: {
          limit: 5,
          key: 'event.data.userId',
        },
        rateLimit: {
          period: '1h',
          limit: 100,
        },
        priority: {
          run: 'event.data.priority ?? 50',
        },
      });

      expect(workflow).toBeDefined();
      expect(workflow.id).toBe('flow-control-test');

      // Verify that function creation includes flow control config
      const inngestFunction = workflow.getFunction();
      expect(inngestFunction).toBeDefined();
    });

    it('should handle workflow configuration with partial flow control properties', async ctx => {
      const inngest = new Inngest({
        id: 'mastra-partial-flow-control',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1 = createStep({
        id: 'step1',
        execute: async ({ inputData }) => {
          return { result: 'step1: ' + inputData.value };
        },
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      // Test workflow with only some flow control properties
      const workflow = createWorkflow({
        id: 'partial-flow-control-test',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1],
        // Only concurrency control
        concurrency: {
          limit: 10,
        },
      });

      expect(workflow).toBeDefined();
      expect(workflow.id).toBe('partial-flow-control-test');

      const inngestFunction = workflow.getFunction();
      expect(inngestFunction).toBeDefined();
    });

    it('should handle workflow configuration without flow control properties (backward compatibility)', async ctx => {
      const inngest = new Inngest({
        id: 'mastra-backward-compat',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1 = createStep({
        id: 'step1',
        execute: async ({ inputData }) => {
          return { result: 'step1: ' + inputData.value };
        },
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      // Test workflow without any flow control properties (existing behavior)
      const workflow = createWorkflow({
        id: 'backward-compat-test',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1],
        retryConfig: {
          attempts: 3,
          delay: 1000,
        },
      });

      expect(workflow).toBeDefined();
      expect(workflow.id).toBe('backward-compat-test');

      const inngestFunction = workflow.getFunction();
      expect(inngestFunction).toBeDefined();
    });

    it('should support all flow control configuration types', async ctx => {
      const inngest = new Inngest({
        id: 'mastra-all-flow-control',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1 = createStep({
        id: 'step1',
        execute: async ({ inputData }) => {
          return { result: 'step1: ' + inputData.value };
        },
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      // Test workflow with all flow control configuration types
      const workflow = createWorkflow({
        id: 'all-flow-control-test',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1],
        // All flow control properties
        concurrency: {
          limit: 5,
          key: 'event.data.userId',
        },
        rateLimit: {
          period: '1m',
          limit: 10,
        },
        throttle: {
          period: '10s',
          limit: 1,
          key: 'event.data.organizationId',
        },
        debounce: {
          period: '5s',
          key: 'event.data.messageId',
        },
        priority: {
          run: 'event.data.priority ?? 0',
        },
      });

      expect(workflow).toBeDefined();
      expect(workflow.id).toBe('all-flow-control-test');

      const inngestFunction = workflow.getFunction();
      expect(inngestFunction).toBeDefined();
    });

    it('should execute workflow via cron schedule', async ctx => {
      const inngest = new Inngest({
        id: 'mastra-cron-test',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1 = createStep({
        id: 'step1',
        execute: async ({ inputData }) => {
          return { result: 'step1: ' + inputData.value };
        },
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      // Use every-minute cron schedule
      const cronSchedule = '* * * * *';
      const now = new Date();

      const workflow = createWorkflow({
        id: 'cron-test',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1],
        cron: cronSchedule,
        inputData: { value: 'cron-input' },
      } as any);

      workflow.then(step1).commit();

      expect(workflow).toBeDefined();
      expect(workflow.id).toBe('cron-test');

      // Set up Mastra with storage and server
      const mastra = new Mastra({
        logger: false,
        workflows: {
          'cron-test': workflow,
        },
        server: {
          apiRoutes: [
            {
              path: '/inngest/api',
              method: 'ALL',
              createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
            },
          ],
        },
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
      });

      const app = await createHonoServer(mastra);

      const srv = (globServer = serve({
        fetch: app.fetch,
        port: (ctx as any).handlerPort,
      }));

      await resetInngest();

      // Poll for workflow runs until we find at least one, or timeout
      const maxWaitTime = 75 * 1000; // 75 seconds max
      const pollInterval = 20 * 1000; // Poll every 20 seconds
      const startTime = Date.now();
      let runs: Awaited<ReturnType<typeof workflow.listWorkflowRuns>>['runs'] = [];
      let total = 0;

      console.log('Waiting for cron to trigger (polling every 20s, max 75s)...');

      while (runs.length === 0 && Date.now() - startTime < maxWaitTime) {
        const result = await workflow.listWorkflowRuns();
        runs = result.runs;
        total = result.total;
        if (runs.length === 0) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
      }

      expect(total).toBeGreaterThanOrEqual(1);
      expect(runs.length).toBeGreaterThanOrEqual(1);

      // Verify the most recent run was successful
      const mostRecentRun = runs[0];
      expect(mostRecentRun).toBeDefined();
      expect(mostRecentRun.workflowName).toBe('cron-test');
      expect(mostRecentRun.snapshot).toBeDefined();

      // Verify the run was created after we scheduled it
      const runCreatedAt = new Date(mostRecentRun.createdAt || 0);
      expect(runCreatedAt.getTime()).toBeGreaterThanOrEqual(now.getTime());

      srv.close();
    }, 90000); // 90 second timeout

    it('should execute workflow via cron schedule with initialState', async ctx => {
      const inngest = new Inngest({
        id: 'mastra-cron-initial-state-test',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1 = createStep({
        id: 'step1',
        execute: async ({ inputData }) => {
          return { result: 'step1: ' + inputData.value };
        },
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      // Use every-minute cron schedule
      const cronSchedule = '* * * * *';
      const now = new Date();

      const workflow = createWorkflow({
        id: 'cron-initial-state-test',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        stateSchema: z.object({ count: z.number() }),
        steps: [step1],
        cron: cronSchedule,
        inputData: { value: 'cron-input' },
        initialState: { count: 0 },
      } as any);

      workflow.then(step1).commit();

      expect(workflow).toBeDefined();
      expect(workflow.id).toBe('cron-initial-state-test');

      // Set up Mastra with storage and server
      const mastra = new Mastra({
        logger: false,
        workflows: {
          'cron-initial-state-test': workflow,
        },
        server: {
          apiRoutes: [
            {
              path: '/inngest/api',
              method: 'ALL',
              createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
            },
          ],
        },
        storage: new DefaultStorage({
          id: 'test-storage-initial-state',
          url: ':memory:',
        }),
      });

      const app = await createHonoServer(mastra);

      const srv = (globServer = serve({
        fetch: app.fetch,
        port: (ctx as any).handlerPort,
      }));

      await resetInngest();

      // Poll for workflow runs until we find at least one, or timeout
      const maxWaitTime = 75 * 1000; // 75 seconds max
      const pollInterval = 20 * 1000; // Poll every 20 seconds
      const startTime = Date.now();
      let runs: Awaited<ReturnType<typeof workflow.listWorkflowRuns>>['runs'] = [];
      let total = 0;

      console.log('Waiting for cron to trigger (polling every 20s, max 75s)...');

      while (runs.length === 0 && Date.now() - startTime < maxWaitTime) {
        const result = await workflow.listWorkflowRuns();
        runs = result.runs;
        total = result.total;
        if (runs.length === 0) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
      }

      expect(total).toBeGreaterThanOrEqual(1);
      expect(runs.length).toBeGreaterThanOrEqual(1);

      // Verify the most recent run was successful
      const mostRecentRun = runs[0];
      expect(mostRecentRun).toBeDefined();
      expect(mostRecentRun.workflowName).toBe('cron-initial-state-test');
      expect(mostRecentRun.snapshot).toBeDefined();

      // Verify the run was created after we scheduled it
      const runCreatedAt = new Date(mostRecentRun.createdAt || 0);
      expect(runCreatedAt.getTime()).toBeGreaterThanOrEqual(now.getTime());

      srv.close();
    }, 90000); // 90 second timeout
  });

  describe('Inngest-specific: serve function with user-supplied functions', () => {
    it('should merge user-supplied functions with workflow functions', async _ctx => {
      const inngest = new Inngest({
        id: 'test-inngest-serve',
      });

      const { createWorkflow, createStep } = init(inngest);

      // Create a simple workflow
      const testWorkflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ text: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const step1 = createStep({
        id: 'echo',
        inputSchema: z.object({ text: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: async ({ inputData }) => ({
          result: `Echo: ${inputData.text}`,
        }),
      });

      testWorkflow.then(step1).commit();

      // Create user-supplied Inngest functions with distinct IDs
      const userFunction1 = inngest.createFunction(
        { id: 'custom-user-handler-one' },
        { event: 'user/custom.event.one' },
        async ({ event }) => {
          return { customResult: event.data.value };
        },
      );

      const userFunction2 = inngest.createFunction(
        { id: 'custom-user-handler-two' },
        { event: 'user/custom.event.two' },
        async ({ event }) => {
          return { doubledResult: event.data.value * 2 };
        },
      );

      // Create a Mastra instance with our test workflow and user functions
      const testMastra = new Mastra({
        workflows: {
          testWorkflow,
        },
        server: {
          apiRoutes: [
            {
              path: '/api/inngest',
              method: 'ALL',
              createHandler: async ({ mastra }) =>
                inngestServe({
                  mastra,
                  inngest,
                  functions: [userFunction1, userFunction2], // Include user functions
                }),
            },
          ],
        },
      });

      // Create and start the server using the same pattern as other tests
      const app = await createHonoServer(testMastra);

      // Use a promise to get the actual listening port
      const { server, port } = await new Promise<{ server: any; port: number }>(resolve => {
        const server = serve(
          {
            fetch: app.fetch,
            port: 0, // Use random available port
          },
          () => {
            const address = server.address();
            const port =
              typeof address === 'string' ? parseInt(address.split(':').pop() || '3000') : address?.port || 3000;
            resolve({ server, port });
          },
        );
      });

      try {
        // Make a request to the Inngest endpoint to get function introspection
        const response = await fetch(`http://127.0.0.1:${port}/api/inngest`);
        expect(response.ok).toBe(true);

        const introspectionData = await response.json();

        // Inngest returns function metadata in the introspection response
        expect(introspectionData).toBeDefined();

        // The key validation: Inngest reports the correct function count
        // This proves our serve function correctly merged 1 workflow function + 2 user functions
        expect(introspectionData.function_count).toBe(3);

        // Verify the response structure is as expected
        expect(introspectionData.mode).toBe('dev');
        expect(introspectionData.schema_version).toBeDefined();
      } finally {
        // Clean up the server
        server.close();
      }
    });

    it('should work with empty user functions array', async _ctx => {
      const inngest = new Inngest({
        id: 'test-inngest-serve-empty',
      });

      const { createWorkflow, createStep } = init(inngest);

      const testWorkflow = createWorkflow({
        id: 'test-workflow-empty',
        inputSchema: z.object({ text: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const step1 = createStep({
        id: 'echo',
        inputSchema: z.object({ text: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: async ({ inputData }) => ({
          result: inputData.text,
        }),
      });

      testWorkflow.then(step1).commit();

      const mastra = new Mastra({
        workflows: {
          testWorkflow,
        },
      });

      // Call serve with empty user functions array
      const serveResult = inngestServe({
        mastra,
        inngest,
        functions: [],
      });

      expect(serveResult).toBeDefined();
    });

    it('should work when no functions parameter is provided', async _ctx => {
      const inngest = new Inngest({
        id: 'test-inngest-serve-no-param',
      });

      const { createWorkflow, createStep } = init(inngest);

      const testWorkflow = createWorkflow({
        id: 'test-workflow-no-param',
        inputSchema: z.object({ text: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const step1 = createStep({
        id: 'echo',
        inputSchema: z.object({ text: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: async ({ inputData }) => ({
          result: inputData.text,
        }),
      });

      testWorkflow.then(step1).commit();

      const mastra = new Mastra({
        workflows: {
          testWorkflow,
        },
      });

      // Call serve without functions parameter (backwards compatibility)
      const serveResult = inngestServe({
        mastra,
        inngest,
      });

      expect(serveResult).toBeDefined();
    });
  });

  describe('Inngest-specific: Streaming with @inngest/realtime', () => {
    it('should generate a stream', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1Action = vi.fn().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn().mockResolvedValue({ result: 'success2' });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [step1, step2],
        options: { validateInputs: false },
      });
      workflow.then(step1).then(step2).commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-workflow': workflow,
        },
        server: {
          apiRoutes: [
            {
              path: '/inngest/api',
              method: 'ALL',
              createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
            },
          ],
        },
      });

      const app = await createHonoServer(mastra);

      const srv = (globServer = serve({
        fetch: app.fetch,
        port: (ctx as any).handlerPort,
      }));
      await resetInngest();

      const runId = 'test-run-id';
      let watchData: StreamEvent[] = [];
      const run = await workflow.createRun({
        runId,
      });

      await resetInngest();

      const { stream, getWorkflowState } = run.streamLegacy({ inputData: {} });

      // Start watching the workflow
      const collectedStreamData: StreamEvent[] = [];
      for await (const data of stream) {
        collectedStreamData.push(JSON.parse(JSON.stringify(data)));
      }
      watchData = collectedStreamData;

      const executionResult = await getWorkflowState();

      await resetInngest();

      srv.close();

      expect(watchData.length).toBe(8);
      expect(watchData).toMatchObject([
        {
          payload: {
            runId: 'test-run-id',
          },
          type: 'start',
        },
        {
          payload: {
            id: 'step1',
            status: 'running',
          },
          type: 'step-start',
        },
        {
          payload: {
            id: 'step1',
            endedAt: expect.any(Number),
            startedAt: expect.any(Number),
            payload: {},
            output: {
              result: 'success1',
            },
            status: 'success',
          },
          type: 'step-result',
        },
        {
          payload: {
            id: 'step1',
            metadata: {},
          },
          type: 'step-finish',
        },
        {
          payload: {
            id: 'step2',
            status: 'running',
          },
          type: 'step-start',
        },
        {
          payload: {
            id: 'step2',
            endedAt: expect.any(Number),
            startedAt: expect.any(Number),
            payload: {
              result: 'success1',
            },
            output: {
              result: 'success2',
            },
            status: 'success',
          },
          type: 'step-result',
        },
        {
          payload: {
            id: 'step2',
            metadata: {},
          },
          type: 'step-finish',
        },
        {
          payload: {
            runId: 'test-run-id',
          },
          type: 'finish',
        },
      ]);
      // Verify execution completed successfully
      expect(executionResult.steps.step1).toMatchObject({
        status: 'success',
        output: { result: 'success1' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(executionResult.steps.step2).toMatchObject({
        status: 'success',
        output: { result: 'success2' },
        payload: {
          result: 'success1',
        },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
    });
  });

  describe('Inngest-specific: Streaming (vNext)', () => {
    it('should generate a stream', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1Action = vi.fn().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn().mockResolvedValue({ result: 'success2' });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [step1, step2],
        options: { validateInputs: false },
      });
      workflow.then(step1).then(step2).commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-workflow': workflow,
        },
        server: {
          apiRoutes: [
            {
              path: '/inngest/api',
              method: 'ALL',
              createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
            },
          ],
        },
      });

      const app = await createHonoServer(mastra);

      const srv = (globServer = serve({
        fetch: app.fetch,
        port: (ctx as any).handlerPort,
      }));
      await resetInngest();

      const runId = 'test-run-id';
      let watchData: StreamEvent[] = [];
      const run = await workflow.createRun({
        runId,
      });

      await resetInngest();

      const streamOutput = run.stream({ inputData: {} });

      // Start watching the workflow
      const collectedStreamData: StreamEvent[] = [];
      for await (const data of streamOutput.fullStream) {
        collectedStreamData.push(JSON.parse(JSON.stringify(data)));
      }
      watchData = collectedStreamData;

      const executionResult = await streamOutput.result;

      srv.close();

      expect(watchData.length).toBe(6);
      expect(watchData).toMatchObject([
        {
          payload: {},
          type: 'workflow-start',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
        {
          payload: {
            id: 'step1',
            payload: {},
            startedAt: expect.any(Number),
          },
          type: 'workflow-step-start',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
        {
          payload: {
            id: 'step1',
            output: {
              result: 'success1',
            },
            endedAt: expect.any(Number),
            status: 'success',
          },
          type: 'workflow-step-result',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
        {
          payload: {
            id: 'step2',
            payload: {
              result: 'success1',
            },
            startedAt: expect.any(Number),
          },
          type: 'workflow-step-start',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
        {
          payload: {
            id: 'step2',
            output: {
              result: 'success2',
            },
            endedAt: expect.any(Number),
            status: 'success',
          },
          type: 'workflow-step-result',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
        {
          payload: {
            metadata: {},
            output: {
              usage: {
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
              },
            },
          },
          type: 'workflow-finish',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
      ]);
      // Verify execution completed successfully
      expect(executionResult.steps.step1).toMatchObject({
        status: 'success',
        output: { result: 'success1' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(executionResult.steps.step2).toMatchObject({
        status: 'success',
        output: { result: 'success2' },
        payload: {
          result: 'success1',
        },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
    });

    it('should generate a stream with custom events', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1 = createStep({
        id: 'step1',
        execute: async ({ writer }) => {
          await writer.write({
            type: 'custom-event',
            payload: {
              hello: 'world',
            },
          });

          return { value: 'success1' };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: async ({ writer }) => {
          await writer.write({
            type: 'custom-event',
            payload: {
              hello: 'world 2',
            },
          });
          return { result: 'success2' };
        },
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [step1, step2],
        options: { validateInputs: false },
      });
      workflow.then(step1).then(step2).commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-workflow': workflow,
        },
        server: {
          apiRoutes: [
            {
              path: '/inngest/api',
              method: 'ALL',
              createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
            },
          ],
        },
      });

      const app = await createHonoServer(mastra);

      const srv = (globServer = serve({
        fetch: app.fetch,
        port: (ctx as any).handlerPort,
      }));
      await resetInngest();

      const runId = 'test-run-id';
      let watchData: StreamEvent[] = [];
      const run = await workflow.createRun({
        runId,
      });

      const streamOutput = run.stream({ inputData: {} });

      // Start watching the workflow
      const collectedStreamData: StreamEvent[] = [];
      for await (const data of streamOutput.fullStream) {
        collectedStreamData.push(JSON.parse(JSON.stringify(data)));
      }
      watchData = collectedStreamData;

      const executionResult = await streamOutput.result;

      srv.close();

      // Custom events test would still include the custom events
      expect(watchData.length).toBe(8); // 6 standard events + 2 custom events
      expect(watchData).toMatchObject([
        {
          payload: {},
          type: 'workflow-start',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
        {
          payload: {
            id: 'step1',
            payload: {},
            startedAt: expect.any(Number),
          },
          type: 'workflow-step-start',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
        {
          type: 'workflow-step-output',
          payload: {
            output: {
              type: 'custom-event',
              payload: {
                hello: 'world',
              },
            },
          },
          from: 'USER',
          runId: 'test-run-id',
        },
        {
          payload: {
            id: 'step1',
            output: {
              value: 'success1',
            },
            endedAt: expect.any(Number),
            status: 'success',
          },
          type: 'workflow-step-result',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
        {
          payload: {
            id: 'step2',
            payload: {
              value: 'success1',
            },
            startedAt: expect.any(Number),
          },
          type: 'workflow-step-start',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
        {
          type: 'workflow-step-output',
          payload: {
            output: {
              type: 'custom-event',
              payload: {
                hello: 'world 2',
              },
            },
          },
          from: 'USER',
          runId: 'test-run-id',
        },
        {
          payload: {
            id: 'step2',
            output: {
              result: 'success2',
            },
            endedAt: expect.any(Number),
            status: 'success',
          },
          type: 'workflow-step-result',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
        {
          payload: {
            metadata: {},
            output: {
              usage: {
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
              },
            },
          },
          type: 'workflow-finish',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
      ]);
      // Verify execution completed successfully
      expect(executionResult.steps.step1).toMatchObject({
        status: 'success',
        output: { value: 'success1' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(executionResult.steps.step2).toMatchObject({
        status: 'success',
        output: { result: 'success2' },
        payload: {
          value: 'success1',
        },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
    });
  });

  describe.sequential('Inngest-specific: startAsync', () => {
    it('should start workflow and complete successfully', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1 = createStep({
        id: 'step1',
        execute: async () => {
          return { result: 'success' };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1],
      });
      workflow.then(step1).commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-workflow': workflow,
        },
        server: {
          apiRoutes: [
            {
              path: '/inngest/api',
              method: 'ALL',
              createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
            },
          ],
        },
      });

      const app = await createHonoServer(mastra);

      const srv = (globServer = serve({
        fetch: app.fetch,
        port: (ctx as any).handlerPort,
      }));

      await resetInngest();

      // Extra delay to ensure Inngest has fully synced functions
      await new Promise(resolve => setTimeout(resolve, 2000));

      const run = await workflow.createRun();
      const { runId } = await run.startAsync({ inputData: {} });

      expect(runId).toBe(run.runId);

      // Poll for completion with longer timeout for Inngest
      let result;
      for (let i = 0; i < 30; i++) {
        result = await workflow.getWorkflowRunById(runId);
        if (result?.status === 'success' || result?.status === 'failed') break;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      expect(result?.status).toBe('success');
      expect(result?.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'success' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      srv.close();
    }, 60000);
  });

  describe('Inngest-specific: Agent step with structured output schema', () => {
    it('should pass structured output from agent step to next step with correct types', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      // Define the structured output schema for the agent
      const articleSchema = z.object({
        title: z.string(),
        summary: z.string(),
        tags: z.array(z.string()),
      });

      const articleJson = JSON.stringify({
        title: 'Test Article',
        summary: 'This is a test summary',
        tags: ['test', 'article'],
      });

      // Mock agent using V2 model that properly supports structured output
      // Use simulateReadableStream for proper async streaming behavior (matches other passing tests)
      const agent = new Agent({
        id: 'article-generator',
        name: 'Article Generator',
        instructions: 'Generate an article with title, summary, and tags',
        model: new MockLanguageModelV2({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [{ type: 'text', text: articleJson }],
            warnings: [],
          }),
          doStream: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: simulateReadableStream({
              chunks: [
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: articleJson },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ],
            }),
          }),
        }),
      });

      // Create agent step WITH structuredOutput schema
      const agentStep = createStep(agent, {
        structuredOutput: {
          schema: articleSchema,
        },
      });

      // This step receives the structured output from the agent directly
      const processArticleStep = createStep({
        id: 'process-article',
        description: 'Process the generated article',
        inputSchema: articleSchema,
        outputSchema: z.object({
          processed: z.boolean(),
          tagCount: z.number(),
        }),
        execute: async ({ inputData }) => {
          // inputData should have title, summary, tags - not just text
          return {
            processed: true,
            tagCount: inputData.tags.length,
          };
        },
      });

      const workflow = createWorkflow({
        id: 'article-workflow',
        inputSchema: z.object({ prompt: z.string() }),
        outputSchema: z.object({ processed: z.boolean(), tagCount: z.number() }),
      });

      // Chain directly - no map needed if outputSchema matches inputSchema
      workflow.then(agentStep).then(processArticleStep).commit();

      const mastra = new Mastra({
        workflows: { 'article-workflow': workflow },
        agents: { 'article-generator': agent },
        server: {
          apiRoutes: [
            {
              path: '/inngest/api',
              method: 'ALL',
              createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
            },
          ],
        },
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
      });

      const app = await createHonoServer(mastra);

      const srv = (globServer = serve({
        fetch: app.fetch,
        port: (ctx as any).handlerPort,
      }));
      await resetInngest();

      const run = await workflow.createRun({ runId: 'structured-output-test' });
      const streamOutput = run.stream({
        inputData: { prompt: 'Generate an article about testing' },
      });

      for await (const _data of streamOutput.fullStream) {
        // consume stream
      }

      const result = await streamOutput.result;

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.result).toEqual({
          processed: true,
          tagCount: 2,
        });
      }
      srv.close();
    });
  });
}, 80e3);
