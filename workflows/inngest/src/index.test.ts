import fs from 'fs';
import path from 'path';
import { openai } from '@ai-sdk/openai';
import { serve } from '@hono/node-server';
import { realtimeMiddleware } from '@inngest/realtime/middleware';
import { Agent } from '@mastra/core/agent';
import { MastraError } from '@mastra/core/error';
import type { MastraScorer } from '@mastra/core/evals';
import { createScorer, runEvals } from '@mastra/core/evals';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { MockStore, TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import type { StreamEvent } from '@mastra/core/workflows';
import { createHonoServer } from '@mastra/deployer/server';
import { DefaultStorage } from '@mastra/libsql';
import { MockLanguageModelV1, simulateReadableStream } from 'ai/test';
import { $ } from 'execa';
import { Inngest } from 'inngest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { z } from 'zod';
import { init, serve as inngestServe } from './index';

interface LocalTestContext {
  inngestPort: number;
  handlerPort: number;
  srv?: any;
}

async function resetInngest() {
  await new Promise(resolve => setTimeout(resolve, 1000));
  await $`docker-compose restart`;
  await new Promise(resolve => setTimeout(resolve, 1500));
}

describe('MastraInngestWorkflow', () => {
  let globServer: any;

  beforeEach<LocalTestContext>(async ctx => {
    ctx.inngestPort = 4000;
    ctx.handlerPort = 4001;

    globServer?.close();

    vi.restoreAllMocks();
  });

  describe.sequential('Basic Workflow Execution', () => {
    it('should be able to bail workflow execution', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1 = createStep({
        id: 'step1',
        execute: async ({ bail, inputData }) => {
          if (inputData.value === 'bail') {
            return bail({ result: 'bailed' });
          }

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
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({
          result: z.string(),
        }),
        steps: [step1, step2],
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

      const run = await workflow.createRun();
      console.log('running');
      const result = await run.start({ inputData: { value: 'bail' } });
      console.log('result', result);

      expect(result.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'bailed' },
        payload: { value: 'bail' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(result.steps['step2']).toBeUndefined();

      const run2 = await workflow.createRun();
      const result2 = await run2.start({ inputData: { value: 'no-bail' } });

      srv.close();

      expect(result2.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'step1: no-bail' },
        payload: { value: 'no-bail' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(result2.steps['step2']).toEqual({
        status: 'success',
        output: { result: 'step2: step1: no-bail' },
        payload: { result: 'step1: no-bail' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
    });

    it('should execute a single step workflow successfully', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);
      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
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
      const result = await run.start({ inputData: {} });

      expect(execute).toHaveBeenCalled();
      expect(result.steps['step1']).toMatchObject({
        status: 'success',
        output: { result: 'success' },
      });

      srv.close();
    });

    it('should throw error when restart is called on inngest workflow', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);
      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
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

    it('should execute a single step workflow successfully with state', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      let calls = 0;
      const step1 = createStep({
        id: 'step1',
        execute: async ({ state }) => {
          calls++;
          return { result: 'success', value: state.value };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string(), value: z.string() }),
        stateSchema: z.object({
          value: z.string(),
          // someOtherValue: z.string(),
        }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
          value: z.string(),
        }),
        stateSchema: z.object({
          value: z.string(),
          otherValue: z.string(),
        }),
        steps: [step1],
      })
        .then(step1)
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
      const result = await run.start({
        inputData: {},
        initialState: { value: 'test-state', otherValue: 'test-other-state' },
      });

      srv.close();

      expect(calls).toBe(1);
      expect(result.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'success', value: 'test-state' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
    });

    it('should execute a single step nested workflow successfully with state', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      let calls = 0;
      const step1 = createStep({
        id: 'step1',
        execute: async ({ state }) => {
          calls++;
          return { result: 'success', value: state.value };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string(), value: z.string() }),
        stateSchema: z.object({
          value: z.string(),
          // someOtherValue: z.string(),
        }),
      });

      const nestedWorkflow = createWorkflow({
        id: 'nested-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string(), value: z.string() }),
        stateSchema: z.object({
          value: z.string(),
          // someOtherValue: z.string(),
        }),
        steps: [step1],
      })
        .then(step1)
        .commit();

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
          value: z.string(),
        }),
        stateSchema: z.object({
          value: z.string(),
          otherValue: z.string(),
        }),
        steps: [nestedWorkflow],
      })
        .then(nestedWorkflow)
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
      const result = await run.start({
        inputData: {},
        initialState: { value: 'test-state', otherValue: 'test-other-state' },
      });

      srv.close();

      expect(calls).toBe(1);
      expect(result.steps['nested-workflow']).toEqual({
        status: 'success',
        output: { result: 'success', value: 'test-state' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
    });

    it('should execute a single step nested workflow successfully with state being set by the nested workflow', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);
      let calls = 0;
      const step1 = createStep({
        id: 'step1',
        execute: async ({ state, setState }) => {
          calls++;
          setState({ ...state, value: state.value + '!!!' });
          return {};
        },
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        stateSchema: z.object({
          value: z.string(),
          // someOtherValue: z.string(),
        }),
      });

      const step2 = createStep({
        id: 'step2',
        execute: async ({ state }) => {
          calls++;
          return { result: 'success', value: state.value };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string(), value: z.string() }),
        stateSchema: z.object({
          value: z.string(),
          // someOtherValue: z.string(),
        }),
      });

      const nestedWorkflow = createWorkflow({
        id: 'nested-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string(), value: z.string() }),
        stateSchema: z.object({
          value: z.string(),
          // someOtherValue: z.string(),
        }),
        steps: [step1, step2],
      })
        .then(step1)
        .then(step2)
        .commit();

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
          value: z.string(),
        }),
        stateSchema: z.object({
          value: z.string(),
          otherValue: z.string(),
        }),
        steps: [nestedWorkflow],
      })
        .then(nestedWorkflow)
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
      const result = await run.start({
        inputData: {},
        initialState: { value: 'test-state', otherValue: 'test-other-state' },
      });

      srv.close();

      expect(calls).toBe(2);
      expect(result.steps['nested-workflow']).toEqual({
        status: 'success',
        output: { result: 'success', value: 'test-state!!!' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
    });

    it('should execute multiple steps in parallel', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1Action = vi.fn().mockImplementation(async () => {
        return { value: 'step1' };
      });
      const step2Action = vi.fn().mockImplementation(async () => {
        return { value: 'step2' };
      });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
        steps: [step1, step2],
      });

      workflow.parallel([step1, step2]).commit();

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
      const result = await run.start({ inputData: {} });

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).toHaveBeenCalled();
      expect(result.steps).toMatchObject({
        input: {},
        step1: { status: 'success', output: { value: 'step1' } },
        step2: { status: 'success', output: { value: 'step2' } },
      });

      srv.close();
    });

    it('should execute multiple steps in parallel with state', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1Action = vi.fn().mockImplementation(async ({ state }) => {
        return { value: 'step1', value2: state.value };
      });
      const step2Action = vi.fn().mockImplementation(async ({ state }) => {
        return { value: 'step2', value2: state.value };
      });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
        stateSchema: z.object({ value: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
        stateSchema: z.object({ value: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
        stateSchema: z.object({ value: z.string() }),
        steps: [step1, step2],
      })
        .parallel([step1, step2])
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
      const result = await run.start({ inputData: {}, initialState: { value: 'test-state' } });

      srv.close();

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).toHaveBeenCalled();
      expect(result.steps).toEqual({
        input: {},
        step1: {
          status: 'success',
          output: { value: 'step1', value2: 'test-state' },
          payload: {},

          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        step2: {
          status: 'success',
          output: { value: 'step2', value2: 'test-state' },
          payload: {},

          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });
    });

    it('should execute steps sequentially', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const executionOrder: string[] = [];

      const step1Action = vi.fn().mockImplementation(() => {
        executionOrder.push('step1');
        return { value: 'step1' };
      });
      const step2Action = vi.fn().mockImplementation(() => {
        executionOrder.push('step2');
        return { value: 'step2' };
      });

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
        outputSchema: z.object({ value: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
        steps: [step1, step2],
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

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(executionOrder).toMatchObject(['step1', 'step2']);
      expect(result.steps).toMatchObject({
        input: {},
        step1: { status: 'success', output: { value: 'step1' } },
        step2: { status: 'success', output: { value: 'step2' } },
      });

      srv.close();
    });

    it('should execute a sleep step', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
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
        // payload: {},
        // startedAt: expect.any(Number),
        // endedAt: expect.any(Number),
      });

      expect(result.steps['step2']).toMatchObject({
        status: 'success',
        output: { result: 'slept successfully: success' },
        // payload: { result: 'success' },
        // startedAt: expect.any(Number),
        // endedAt: expect.any(Number),
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

      const execute = vi.fn<any>().mockResolvedValue({ value: 1000 });
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
        // payload: {},
        // startedAt: expect.any(Number),
        // endedAt: expect.any(Number),
      });

      expect(result.steps['step2']).toMatchObject({
        status: 'success',
        output: { value: 2000 },
        // payload: { result: 'success' },
        // startedAt: expect.any(Number),
        // endedAt: expect.any(Number),
      });

      expect(endTime - startTime).toBeGreaterThan(1000);

      srv.close();
    });

    it('should execute a a sleep until step', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
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
        // payload: {},
        // startedAt: expect.any(Number),
        // endedAt: expect.any(Number),
      });

      expect(result.steps['step2']).toMatchObject({
        status: 'success',
        output: { result: 'slept successfully: success' },
        // payload: { result: 'success' },
        // startedAt: expect.any(Number),
        // endedAt: expect.any(Number),
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

      const execute = vi.fn<any>().mockResolvedValue({ value: 1000 });
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
        // payload: {},
        // startedAt: expect.any(Number),
        // endedAt: expect.any(Number),
      });

      expect(result.steps['step2']).toMatchObject({
        status: 'success',
        output: { value: 2000 },
        // payload: { result: 'success' },
        // startedAt: expect.any(Number),
        // endedAt: expect.any(Number),
      });

      expect(endTime - startTime).toBeGreaterThan(1000);

      srv.close();
    }, 50_000);

    it('should throw error if waitForEvent is used', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
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
        // @ts-expect-error - we expect this to throw an error
        workflow.then(step1).waitForEvent('hello-event', step2).commit();
      } catch (error) {
        expect(error).toBeInstanceOf(MastraError);
        expect(error).toHaveProperty(
          'message',
          'waitForEvent has been removed. Please use suspend & resume flow instead. See https://mastra.ai/en/docs/workflows/suspend-and-resume for more details.',
        );
      }
    });

    it('should persist a workflow run with resourceId', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);
      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
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

      const run = await workflow.createRun({ resourceId: 'test-resource-id' });
      const result = await run.start({ inputData: {} });

      const runById = await workflow.getWorkflowRunById(run.runId);
      expect(runById?.resourceId).toBe('test-resource-id');

      expect(execute).toHaveBeenCalled();
      expect(result.steps['step1']).toMatchObject({
        status: 'success',
        output: { result: 'success' },
      });

      srv.close();
    });
  });

  describe('abort', () => {
    it('should be able to abort workflow execution in between steps', async ctx => {
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

    it('should be able to abort workflow execution during a step', async ctx => {
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
        execute: async ({ inputData, abortSignal, abort }) => {
          console.log('abort signal', abortSignal);
          const timeout: Promise<string> = new Promise((resolve, _reject) => {
            const ref = setTimeout(() => {
              resolve('step2: ' + inputData.result);
            }, 5000);

            abortSignal.addEventListener('abort', () => {
              resolve('');
              clearTimeout(ref);
            });
          });

          const result = await timeout;
          if (abortSignal.aborted) {
            return abort();
          }
          return { result };
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

      const run = await workflow.createRun();
      const p = run.start({ inputData: { value: 'test' } });

      setTimeout(() => {
        run.cancel();
      }, 1000);

      const result = await p;
      console.log('result', result);

      srv.close();

      expect(result.status).toBe('canceled');
      expect(result.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'step1: test' },
        payload: { value: 'test' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      // expect(result.steps['step2']).toEqual({
      //   status: 'canceled',
      //   payload: { result: 'step1: test' },
      //   output: undefined,
      //   startedAt: expect.any(Number),
      //   endedAt: expect.any(Number),
      // });
    });
  });

  describe('Variable Resolution', () => {
    it('should resolve trigger data', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });

      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({ inputData: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute,
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ inputData: z.string() }),
        outputSchema: z.object({}),
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

      const run = await workflow.createRun();
      const result = await run.start({ inputData: { inputData: 'test-input' } });

      expect(result.steps.step1).toMatchObject({ status: 'success', output: { result: 'success' } });
      expect(result.steps.step2).toMatchObject({ status: 'success', output: { result: 'success' } });

      srv.close();
    });

    it('should provide access to step results and trigger data via getStepResult helper', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1Action = vi.fn().mockImplementation(async ({ inputData }) => {
        // Test accessing trigger data with correct type
        expect(inputData).toMatchObject({ inputValue: 'test-input' });
        return { value: 'step1-result' };
      });

      const step2Action = vi.fn().mockImplementation(async ({ getStepResult }) => {
        // Test accessing previous step result with type
        const step1Result = getStepResult(step1);
        expect(step1Result).toMatchObject({ value: 'step1-result' });

        const failedStep = getStepResult(nonExecutedStep);
        expect(failedStep).toBe(null);

        return { value: 'step2-result' };
      });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({ inputValue: z.string() }),
        outputSchema: z.object({ value: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ value: z.string() }),
      });

      const nonExecutedStep = createStep({
        id: 'non-executed-step',
        execute: vi.fn(),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ inputValue: z.string() }),
        outputSchema: z.object({ value: z.string() }),
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

      const run = await workflow.createRun();
      const result = await run.start({ inputData: { inputValue: 'test-input' } });

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).toHaveBeenCalled();
      expect(result.steps).toMatchObject({
        input: { inputValue: 'test-input' },
        step1: { status: 'success', output: { value: 'step1-result' } },
        step2: { status: 'success', output: { value: 'step2-result' } },
      });

      srv.close();
    });

    it('should resolve trigger data from context', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
      const triggerSchema = z.object({
        inputData: z.string(),
      });

      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: triggerSchema,
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: triggerSchema,
        outputSchema: z.object({ result: z.string() }),
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
      await run.start({ inputData: { inputData: 'test-input' } });

      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          inputData: { inputData: 'test-input' },
        }),
      );

      srv.close();
    });

    it('should resolve trigger data from getInitData', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
      const triggerSchema = z.object({
        cool: z.string(),
      });

      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: triggerSchema,
        outputSchema: z.object({ result: z.string() }),
      });

      const step2 = createStep({
        id: 'step2',
        execute: async ({ getInitData }) => {
          const initData = getInitData<typeof workflow>();
          return { result: initData };
        },
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.object({ cool: z.string() }) }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: triggerSchema,
        outputSchema: z.object({ result: z.string() }),
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

      const run = await workflow.createRun();
      const result = await run.start({ inputData: { cool: 'test-input' } });

      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          inputData: { cool: 'test-input' },
        }),
      );

      expect(result.steps.step2).toMatchObject({ status: 'success', output: { result: { cool: 'test-input' } } });

      srv.close();
    });

    it('should resolve variables from previous steps', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1Action = vi.fn<any>().mockResolvedValue({
        nested: { value: 'step1-data' },
      });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'success' });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ nested: z.object({ value: z.string() }) }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({ previousValue: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      workflow
        .then(step1)
        .map({
          previousValue: {
            step: step1,
            path: 'nested.value',
          },
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
      await run.start({ inputData: {} });

      expect(step2Action).toHaveBeenCalledWith(
        expect.objectContaining({
          inputData: {
            previousValue: 'step1-data',
          },
        }),
      );

      srv.close();
    });
  });

  describe('Simple Conditions', () => {
    it('should follow conditional chains', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1Action = vi.fn().mockImplementation(() => {
        return Promise.resolve({ status: 'success' });
      });
      const step2Action = vi.fn().mockImplementation(() => {
        return Promise.resolve({ result: 'step2' });
      });
      const step3Action = vi.fn().mockImplementation(() => {
        return Promise.resolve({ result: 'step3' });
      });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ status: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });
      const step3 = createStep({
        id: 'step3',
        execute: step3Action,
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1, step2, step3],
      });

      workflow
        .then(step1)
        .branch([
          [
            async ({ inputData }) => {
              return inputData.status === 'success';
            },
            step2,
          ],
          [
            async ({ inputData }) => {
              return inputData.status === 'failed';
            },
            step3,
          ],
        ])
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
      const result = await run.start({ inputData: { status: 'success' } });
      srv.close();

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).toHaveBeenCalled();
      expect(step3Action).not.toHaveBeenCalled();
      expect(result.steps).toMatchObject({
        input: { status: 'success' },
        step1: { status: 'success', output: { status: 'success' } },
        step2: { status: 'success', output: { result: 'step2' } },
      });
    });

    it('should follow conditional chains with state', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1Action = vi.fn().mockImplementation(({ state }) => {
        return Promise.resolve({ status: 'success', value: state.value });
      });
      const step2Action = vi.fn().mockImplementation(({ state }) => {
        return Promise.resolve({ result: 'step2', value: state.value });
      });
      const step3Action = vi.fn().mockImplementation(({ state }) => {
        return Promise.resolve({ result: 'step3', value: state.value });
      });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ status: z.string() }),
        stateSchema: z.object({ value: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        stateSchema: z.object({ value: z.string() }),
      });
      const step3 = createStep({
        id: 'step3',
        execute: step3Action,
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        stateSchema: z.object({ value: z.string() }),
      });
      const step4 = createStep({
        id: 'step4',
        execute: async ({ inputData, state }) => {
          return { result: inputData.result, value: state.value };
        },
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        stateSchema: z.object({ value: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1, step2, step3],
        stateSchema: z.object({ value: z.string() }),
      })
        .then(step1)
        .branch([
          [
            async ({ inputData }) => {
              return inputData.status === 'success';
            },
            step2,
          ],
          [
            async ({ inputData }) => {
              return inputData.status === 'failed';
            },
            step3,
          ],
        ])
        .map({
          result: {
            step: [step3, step2],
            path: 'result',
          },
        })
        .then(step4)
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
      const result = await run.start({ inputData: { status: 'success' }, initialState: { value: 'test-state' } });

      srv.close();

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).toHaveBeenCalled();
      expect(step3Action).not.toHaveBeenCalled();
      expect(result.steps).toMatchObject({
        input: { status: 'success' },
        step1: { status: 'success', output: { status: 'success', value: 'test-state' } },
        step2: { status: 'success', output: { result: 'step2', value: 'test-state' } },
        step4: { status: 'success', output: { result: 'step2', value: 'test-state' } },
      });
    });

    it('should handle failing dependencies', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      let err: Error | undefined;
      const step1Action = vi.fn<any>().mockImplementation(() => {
        err = new Error('Failed');
        throw err;
      });
      const step2Action = vi.fn<any>();

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [step1, step2],
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

      const run = await workflow.createRun();
      let result: Awaited<ReturnType<typeof run.start>> | undefined = undefined;
      try {
        result = await run.start({ inputData: {} });
      } catch {
        // do nothing
      }

      srv.close();

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).not.toHaveBeenCalled();
      expect(result?.steps).toMatchObject({
        input: {},
        step1: { status: 'failed', error: 'Failed' },
      });
    });

    it('should support simple string conditions', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1Action = vi.fn<any>().mockResolvedValue({ status: 'success' });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'step2' });
      const step3Action = vi.fn<any>().mockResolvedValue({ result: 'step3' });
      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ status: z.string() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });
      const step3 = createStep({
        id: 'step3',
        execute: step3Action,
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [step1, step2, step3],
        options: { validateInputs: false },
      });
      workflow
        .then(step1)
        .branch([
          [
            async ({ inputData }) => {
              return inputData.status === 'success';
            },
            step2,
          ],
        ])
        .map({
          result: {
            step: step3,
            path: 'result',
          },
        })
        .branch([
          [
            async ({ inputData }) => {
              return inputData.result === 'unexpected value';
            },
            step3,
          ],
        ])
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
      const result = await run.start({ inputData: { status: 'success' } });
      srv.close();

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).toHaveBeenCalled();
      expect(step3Action).not.toHaveBeenCalled();
      expect(result.steps).toMatchObject({
        input: { status: 'success' },
        step1: { status: 'success', output: { status: 'success' } },
        step2: { status: 'success', output: { result: 'step2' } },
      });
    });

    it('should support custom condition functions', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1Action = vi.fn<any>().mockResolvedValue({ count: 5 });
      const step2Action = vi.fn<any>();

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ count: z.number() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({ count: z.number() }),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      workflow
        .then(step1)
        .branch([
          [
            async ({ getStepResult }) => {
              const step1Result = getStepResult(step1);

              return step1Result ? step1Result.count > 3 : false;
            },
            step2,
          ],
        ])
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
      const result = await run.start({ inputData: { count: 5 } });
      srv.close();

      expect(step2Action).toHaveBeenCalled();
      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { count: 5 },
      });
      expect(result.steps.step2).toMatchObject({
        status: 'success',
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle step execution errors', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const error = new Error('Step execution failed');
      const failingAction = vi.fn<any>().mockRejectedValue(error);

      const step1 = createStep({
        id: 'step1',
        execute: failingAction,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
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

      await expect(run.start({ inputData: {} })).resolves.toMatchObject({
        steps: {
          step1: {
            error: 'Step execution failed',
            status: 'failed',
          },
        },
      });

      srv.close();
    });

    it('should handle step execution errors within branches', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const error = new Error('Step execution failed');
      const failingAction = vi.fn<any>().mockRejectedValue(error);
      const successAction = vi.fn<any>().mockResolvedValue({});

      const step1 = createStep({
        id: 'step1',
        execute: successAction,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const step2 = createStep({
        id: 'step2',
        execute: failingAction,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const step3 = createStep({
        id: 'step3',
        execute: successAction,
        inputSchema: z.object({
          step1: z.object({}),
          step2: z.object({}),
        }),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      workflow.parallel([step1, step2]).then(step3).commit();

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
      const result = await run.start({ inputData: {} });

      expect(result.steps).toMatchObject({
        step1: {
          status: 'success',
        },
        step2: {
          status: 'failed',
          error: 'Step execution failed',
        },
      });

      srv.close();
    });

    it('should handle step execution errors within nested workflows', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const error = new Error('Step execution failed');
      const failingAction = vi.fn<any>().mockRejectedValue(error);
      const successAction = vi.fn<any>().mockResolvedValue({});

      const step1 = createStep({
        id: 'step1',
        execute: successAction,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const step2 = createStep({
        id: 'step2',
        execute: failingAction,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const step3 = createStep({
        id: 'step3',
        execute: successAction,
        inputSchema: z.object({
          step1: z.object({}),
          step2: z.object({}),
        }),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      workflow.parallel([step1, step2]).then(step3).commit();

      const mainWorkflow = createWorkflow({
        id: 'main-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      })
        .then(workflow)
        .commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'main-workflow': mainWorkflow,
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

      const run = await mainWorkflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.steps).toMatchObject({
        'test-workflow': {
          status: 'failed',
          error: 'Step execution failed',
        },
      });

      srv.close();
    });
  });

  describe('Complex Conditions', () => {
    it('should handle nested AND/OR conditions', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1Action = vi.fn<any>().mockResolvedValue({
        status: 'partial',
        score: 75,
        flags: { isValid: true },
      });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'step2' });
      const step3Action = vi.fn<any>().mockResolvedValue({ result: 'step3' });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({
          status: z.string(),
          score: z.number(),
          flags: z.object({ isValid: z.boolean() }),
        }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({
          status: z.string(),
          score: z.number(),
          flags: z.object({ isValid: z.boolean() }),
        }),
        outputSchema: z.object({ result: z.string() }),
      });
      const step3 = createStep({
        id: 'step3',
        execute: step3Action,
        inputSchema: z.object({
          result: z.string(),
        }),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      workflow
        .then(step1)
        .branch([
          [
            async ({ getStepResult }) => {
              const step1Result = getStepResult(step1);
              return (
                step1Result?.status === 'success' || (step1Result?.status === 'partial' && step1Result?.score >= 70)
              );
            },
            step2,
          ],
        ])
        .map({
          result: {
            step: step2,
            path: 'result',
          },
        })
        .branch([
          [
            async ({ inputData, getStepResult }) => {
              const step1Result = getStepResult(step1);
              return !inputData.result || step1Result?.score < 70;
            },
            step3,
          ],
        ])
        .map({
          result: {
            step: step3,
            path: 'result',
          },
        })
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
      const result = await run.start({ inputData: {} });

      expect(step2Action).toHaveBeenCalled();
      expect(step3Action).not.toHaveBeenCalled();
      expect(result.steps.step2).toMatchObject({ status: 'success', output: { result: 'step2' } });

      srv.close();
    });
  });

  describe('Loops', () => {
    it('should run an until loop', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const increment = vi.fn().mockImplementation(async ({ inputData }) => {
        // Get the current value (either from trigger or previous increment)
        const currentValue = inputData.value;

        // Increment the value
        const newValue = currentValue + 1;

        return { value: newValue };
      });
      const incrementStep = createStep({
        id: 'increment',
        description: 'Increments the current value by 1',
        inputSchema: z.object({
          value: z.number(),
          target: z.number(),
        }),
        outputSchema: z.object({
          value: z.number(),
        }),
        execute: increment,
      });

      const final = vi.fn().mockImplementation(async ({ inputData }) => {
        return { finalValue: inputData?.value };
      });
      const finalStep = createStep({
        id: 'final',
        description: 'Final step that prints the result',
        inputSchema: z.object({
          value: z.number(),
        }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        execute: final,
      });

      const counterWorkflow = createWorkflow({
        steps: [incrementStep, finalStep],
        id: 'counter-workflow',
        inputSchema: z.object({
          target: z.number(),
          value: z.number(),
        }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        options: { validateInputs: false },
      });
      let totalCount = 0;
      counterWorkflow
        .dountil(incrementStep, async ({ inputData, iterationCount }) => {
          totalCount = iterationCount;
          return (inputData?.value ?? 0) >= 12;
        })
        .then(finalStep)
        .commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-workflow': counterWorkflow,
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

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: { target: 10, value: 0 } });

      expect(increment).toHaveBeenCalledTimes(12);
      expect(final).toHaveBeenCalledTimes(1);
      // @ts-ignore
      expect(result.result).toMatchObject({ finalValue: 12 });
      // @ts-ignore
      expect(result.steps.increment.output).toMatchObject({ value: 12 });
      expect(totalCount).toBe(12);

      srv.close();
    });

    it('should run a while loop', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const increment = vi.fn().mockImplementation(async ({ inputData }) => {
        // Get the current value (either from trigger or previous increment)
        const currentValue = inputData.value;

        // Increment the value
        const newValue = currentValue + 1;

        return { value: newValue };
      });
      const incrementStep = createStep({
        id: 'increment',
        description: 'Increments the current value by 1',
        inputSchema: z.object({
          value: z.number(),
          target: z.number(),
        }),
        outputSchema: z.object({
          value: z.number(),
        }),
        execute: increment,
      });

      const final = vi.fn().mockImplementation(async ({ inputData }) => {
        return { finalValue: inputData?.value };
      });
      const finalStep = createStep({
        id: 'final',
        description: 'Final step that prints the result',
        inputSchema: z.object({
          value: z.number(),
        }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        execute: final,
      });

      const counterWorkflow = createWorkflow({
        steps: [incrementStep, finalStep],
        id: 'counter-workflow',
        inputSchema: z.object({
          target: z.number(),
          value: z.number(),
        }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        options: { validateInputs: false },
      });
      let totalCount = 0;
      counterWorkflow
        .dowhile(incrementStep, async ({ inputData, iterationCount }) => {
          totalCount = iterationCount;
          return (inputData?.value ?? 0) < 12;
        })
        .then(finalStep)
        .commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-workflow': counterWorkflow,
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

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: { target: 10, value: 0 } });

      expect(increment).toHaveBeenCalledTimes(12);
      expect(final).toHaveBeenCalledTimes(1);
      // @ts-ignore
      expect(result.result).toMatchObject({ finalValue: 12 });
      // @ts-ignore
      expect(result.steps.increment.output).toMatchObject({ value: 12 });
      expect(totalCount).toBe(12);
      srv.close();
    });
  });

  describe('foreach', () => {
    it('should run a single item concurrency (default) for loop', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const startTime = Date.now();
      const map = vi.fn().mockImplementation(async ({ inputData }) => {
        await new Promise(resolve => setTimeout(resolve, 1e3));
        return { value: inputData.value + 11 };
      });
      const mapStep = createStep({
        id: 'map',
        description: 'Maps (+11) on the current value',
        inputSchema: z.object({
          value: z.number(),
        }),
        outputSchema: z.object({
          value: z.number(),
        }),
        execute: map,
      });

      const finalStep = createStep({
        id: 'final',
        description: 'Final step that prints the result',
        inputSchema: z.array(z.object({ value: z.number() })),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        execute: async ({ inputData }) => {
          return { finalValue: inputData.reduce((acc, curr) => acc + curr.value, 0) };
        },
      });

      const counterWorkflow = createWorkflow({
        steps: [mapStep, finalStep],
        id: 'counter-workflow',
        inputSchema: z.array(z.object({ value: z.number() })),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        options: { validateInputs: false },
      });

      counterWorkflow.foreach(mapStep).then(finalStep).commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-workflow': counterWorkflow,
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

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: [{ value: 1 }, { value: 22 }, { value: 333 }] });

      const endTime = Date.now();
      const duration = endTime - startTime;
      expect(duration).toBeGreaterThan(1e3 * 3);

      expect(map).toHaveBeenCalledTimes(3);
      expect(result.steps).toMatchObject({
        input: [{ value: 1 }, { value: 22 }, { value: 333 }],
        map: { status: 'success', output: [{ value: 12 }, { value: 33 }, { value: 344 }] },
        final: { status: 'success', output: { finalValue: 1 + 11 + (22 + 11) + (333 + 11) } },
      });

      srv.close();
    });
  });

  describe('if-else branching', () => {
    it('should run the if-then branch', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const start = vi.fn().mockImplementation(async ({ inputData }) => {
        // Get the current value (either from trigger or previous increment)

        // Increment the value
        const newValue = (inputData?.startValue ?? 0) + 1;

        return { newValue };
      });
      const startStep = createStep({
        id: 'start',
        description: 'Increments the current value by 1',
        inputSchema: z.object({
          startValue: z.number(),
        }),
        outputSchema: z.object({
          newValue: z.number(),
        }),
        execute: start,
      });

      const other = vi.fn().mockImplementation(async () => {
        return { other: 26 };
      });
      const otherStep = createStep({
        id: 'other',
        description: 'Other step',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({
          other: z.number(),
        }),
        execute: other,
      });

      const final = vi.fn().mockImplementation(async ({ getStepResult }) => {
        const startVal = getStepResult(startStep)?.newValue ?? 0;
        const otherVal = getStepResult(otherStep)?.other ?? 0;
        return { finalValue: startVal + otherVal };
      });
      const finalIf = createStep({
        id: 'finalIf',
        description: 'Final step that prints the result',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        execute: final,
      });
      const finalElse = createStep({
        id: 'finalElse',
        description: 'Final step that prints the result',
        inputSchema: z.object({ other: z.number() }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        execute: final,
      });

      const counterWorkflow = createWorkflow({
        id: 'counter-workflow',
        inputSchema: z.object({
          startValue: z.number(),
        }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        options: { validateInputs: false },
        steps: [startStep, finalIf],
      });

      const elseBranch = createWorkflow({
        id: 'else-branch',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        options: { validateInputs: false },
        steps: [otherStep, finalElse],
      })
        .then(otherStep)
        .then(finalElse)
        .commit();

      counterWorkflow
        .then(startStep)
        .branch([
          [
            async ({ inputData }) => {
              const current = inputData.newValue;
              return !current || current < 5;
            },
            finalIf,
          ],
          [
            async ({ inputData }) => {
              const current = inputData.newValue;
              return current >= 5;
            },
            elseBranch,
          ],
        ])
        .commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-workflow': counterWorkflow,
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

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: { startValue: 1 } });

      expect(start).toHaveBeenCalledTimes(1);
      expect(other).toHaveBeenCalledTimes(0);
      expect(final).toHaveBeenCalledTimes(1);
      // @ts-ignore
      expect(result.steps.finalIf.output).toMatchObject({ finalValue: 2 });
      // @ts-ignore
      expect(result.steps.start.output).toMatchObject({ newValue: 2 });

      srv.close();
    });

    it('should run the else branch', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const start = vi.fn().mockImplementation(async ({ inputData }) => {
        // Get the current value (either from trigger or previous increment)

        // Increment the value
        const newValue = (inputData?.startValue ?? 0) + 1;

        return { newValue };
      });
      const startStep = createStep({
        id: 'start',
        description: 'Increments the current value by 1',
        inputSchema: z.object({
          startValue: z.number(),
        }),
        outputSchema: z.object({
          newValue: z.number(),
        }),
        execute: start,
      });

      const other = vi.fn().mockImplementation(async ({ inputData }) => {
        return { newValue: inputData.newValue, other: 26 };
      });
      const otherStep = createStep({
        id: 'other',
        description: 'Other step',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({
          other: z.number(),
          newValue: z.number(),
        }),
        execute: other,
      });

      const final = vi.fn().mockImplementation(async ({ inputData }) => {
        const startVal = inputData?.newValue ?? 0;
        const otherVal = inputData?.other ?? 0;
        return { finalValue: startVal + otherVal };
      });
      const finalIf = createStep({
        id: 'finalIf',
        description: 'Final step that prints the result',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        execute: final,
      });
      const finalElse = createStep({
        id: 'finalElse',
        description: 'Final step that prints the result',
        inputSchema: z.object({ other: z.number(), newValue: z.number() }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        execute: final,
      });

      const counterWorkflow = createWorkflow({
        id: 'counter-workflow',
        inputSchema: z.object({
          startValue: z.number(),
        }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        options: { validateInputs: false },
        steps: [startStep, finalIf],
      });

      const elseBranch = createWorkflow({
        id: 'else-branch',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        options: { validateInputs: false },
        steps: [otherStep, finalElse],
      })
        .then(otherStep)
        .then(finalElse)
        .commit();

      counterWorkflow
        .then(startStep)
        .branch([
          [
            async ({ inputData }) => {
              const current = inputData.newValue;
              return !current || current < 5;
            },
            finalIf,
          ],
          [
            async ({ inputData }) => {
              const current = inputData.newValue;
              return current >= 5;
            },
            elseBranch,
          ],
        ])
        .commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-workflow': counterWorkflow,
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

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: { startValue: 6 } });

      srv.close();

      expect(start).toHaveBeenCalledTimes(1);
      expect(other).toHaveBeenCalledTimes(1);
      expect(final).toHaveBeenCalledTimes(1);
      // @ts-ignore
      expect(result.steps['else-branch'].output).toMatchObject({ finalValue: 26 + 6 + 1 });
      // @ts-ignore
      expect(result.steps.start.output).toMatchObject({ newValue: 7 });
    });
  });

  describe('Schema Validation', () => {
    it.skip('should validate trigger data against schema', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const triggerSchema = z.object({
        required: z.string(),
        nested: z.object({
          value: z.number(),
        }),
      });

      const step1 = createStep({
        id: 'step1',
        execute: vi.fn<any>().mockResolvedValue({ result: 'success' }),
        inputSchema: z.object({
          required: z.string(),
          nested: z.object({
            value: z.number(),
          }),
        }),
        outputSchema: z.object({
          result: z.string(),
        }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: triggerSchema,
        outputSchema: z.object({}),
        steps: [step1],
      });

      workflow.then(step1).commit();

      // Should fail validation
      await expect(
        workflow.execute({
          inputData: {
            required: 'test',
            // @ts-expect-error
            nested: { value: 'not-a-number' },
          },
        }),
      ).rejects.toThrow();

      // Should pass validation
      const run = await workflow.createRun();
      await run.start({
        inputData: {
          required: 'test',
          nested: { value: 42 },
        },
      });
    });
  });

  describe('multiple chains', () => {
    it('should run multiple chains in parallel', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1 = createStep({
        id: 'step1',
        execute: vi.fn<any>().mockResolvedValue({ result: 'success1' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step2 = createStep({
        id: 'step2',
        execute: vi.fn<any>().mockResolvedValue({ result: 'success2' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step3 = createStep({
        id: 'step3',
        execute: vi.fn<any>().mockResolvedValue({ result: 'success3' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step4 = createStep({
        id: 'step4',
        execute: vi.fn<any>().mockResolvedValue({ result: 'success4' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step5 = createStep({
        id: 'step5',
        execute: vi.fn<any>().mockResolvedValue({ result: 'success5' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [step1, step2, step3, step4, step5],
      });
      workflow
        .parallel([
          createWorkflow({
            id: 'nested-a',
            inputSchema: z.object({}),
            outputSchema: z.object({}),
            steps: [step1, step2, step3],
          })
            .then(step1)
            .then(step2)
            .then(step3)
            .commit(),
          createWorkflow({
            id: 'nested-b',
            inputSchema: z.object({}),
            outputSchema: z.object({}),
            steps: [step4, step5],
          })
            .then(step4)
            .then(step5)
            .commit(),
        ])
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
      const result = await run.start({ inputData: {} });

      srv.close();

      expect(result.steps['nested-a']).toMatchObject({ status: 'success', output: { result: 'success3' } });
      expect(result.steps['nested-b']).toMatchObject({ status: 'success', output: { result: 'success5' } });
    });
  });

  describe('Retry', () => {
    it('should retry a step default 0 times', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1 = createStep({
        id: 'step1',
        execute: vi.fn<any>().mockResolvedValue({ result: 'success' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step2 = createStep({
        id: 'step2',
        execute: vi.fn<any>().mockRejectedValue(new Error('Step failed')),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
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

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      srv.close();

      expect(result.steps.step1).toMatchObject({ status: 'success', output: { result: 'success' } });
      expect(result.steps.step2).toMatchObject({ status: 'failed', error: 'Step failed' });
      expect(step1.execute).toHaveBeenCalledTimes(1);
      expect(step2.execute).toHaveBeenCalledTimes(1); // 0 retries + 1 initial call
    });

    it('should retry a step with a custom retry config', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1 = createStep({
        id: 'step1',
        execute: vi.fn<any>().mockResolvedValue({ result: 'success' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step2 = createStep({
        id: 'step2',
        execute: vi.fn<any>().mockRejectedValue(new Error('Step failed')),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        retryConfig: {
          attempts: 2,
          delay: 1, // if the delay is 0 it will default to inngest's default backoff delay
        },
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

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.steps.step1.status).toBe('success');
      expect(result.steps.step2.status).toBe('failed');
      expect(result.status).toBe('failed');

      srv.close();

      expect(step1.execute).toHaveBeenCalledTimes(1);
      expect(step2.execute).toHaveBeenCalledTimes(3); // 1 initial + 2 retries (retryConfig.attempts = 2)
    });
  });

  describe('Interoperability (Actions)', () => {
    it('should be able to use all action types in a workflow', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1Action = vi.fn<any>().mockResolvedValue({ name: 'step1' });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ name: z.string() }),
      });

      // @ts-ignore
      const toolAction = vi.fn<any>().mockImplementation(async ({ name }) => {
        return { name };
      });

      const randomTool = createTool({
        id: 'random-tool',
        execute: toolAction,
        description: 'random-tool',
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.object({ name: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ name: z.string() }),
      });

      workflow.then(step1).then(createStep(randomTool)).commit();

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
      const result = await run.start({ inputData: {} });

      srv.close();

      expect(step1Action).toHaveBeenCalled();
      expect(toolAction).toHaveBeenCalled();
      expect(result.steps.step1).toMatchObject({ status: 'success', output: { name: 'step1' } });
      expect(result.steps['random-tool']).toMatchObject({ status: 'success', output: { name: 'step1' } });
    });
  });

  describe('Suspend and Resume', () => {
    afterAll(async () => {
      const pathToDb = path.join(process.cwd(), 'mastra.db');

      if (fs.existsSync(pathToDb)) {
        fs.rmSync(pathToDb);
      }
    });
    it('should return the correct runId', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow } = init(inngest);

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [],
      });
      const run = await workflow.createRun();
      const run2 = await workflow.createRun({ runId: run.runId });

      expect(run.runId).toBeDefined();
      expect(run2.runId).toBeDefined();
      expect(run.runId).toBe(run2.runId);
    });

    it('should handle basic suspend and resume flow with async await syntax', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);
      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          await suspend({ testPayload: 'hello' });
          return undefined;
        })
        .mockImplementationOnce(() => ({ modelOutput: 'test output' }));
      const evaluateToneAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.8 },
        completenessScore: { score: 0.7 },
      });
      const improveResponseAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          await suspend();
          return undefined;
        })
        .mockImplementationOnce(() => ({ improvedOutput: 'improved output' }));
      const evaluateImprovedAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.9 },
        completenessScore: { score: 0.8 },
      });

      const getUserInput = createStep({
        id: 'getUserInput',
        execute: getUserInputAction,
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ userInput: z.string() }),
      });
      const promptAgent = createStep({
        id: 'promptAgent',
        execute: promptAgentAction,
        inputSchema: z.object({ userInput: z.string() }),
        outputSchema: z.object({ modelOutput: z.string() }),
        suspendSchema: z.object({ testPayload: z.string() }),
        resumeSchema: z.object({ userInput: z.string() }),
      });
      const evaluateTone = createStep({
        id: 'evaluateToneConsistency',
        execute: evaluateToneAction,
        inputSchema: z.object({ modelOutput: z.string() }),
        outputSchema: z.object({
          toneScore: z.any(),
          completenessScore: z.any(),
        }),
      });
      const improveResponse = createStep({
        id: 'improveResponse',
        execute: improveResponseAction,
        resumeSchema: z.object({
          toneScore: z.object({ score: z.number() }),
          completenessScore: z.object({ score: z.number() }),
        }),
        inputSchema: z.object({ toneScore: z.any(), completenessScore: z.any() }),
        outputSchema: z.object({ improvedOutput: z.string() }),
      });
      const evaluateImproved = createStep({
        id: 'evaluateImprovedResponse',
        execute: evaluateImprovedAction,
        inputSchema: z.object({ improvedOutput: z.string() }),
        outputSchema: z.object({
          toneScore: z.any(),
          completenessScore: z.any(),
        }),
      });

      const promptEvalWorkflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({}),
      });

      promptEvalWorkflow
        .then(getUserInput)
        .then(promptAgent)
        .then(evaluateTone)
        .then(improveResponse)
        .then(evaluateImproved)
        .commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-workflow': promptEvalWorkflow,
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

      const run = await promptEvalWorkflow.createRun();

      const initialResult = await run.start({ inputData: { input: 'test' } });
      expect(initialResult.steps.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);
      // expect(initialResult.activePaths.size).toBe(1);
      // expect(initialResult.activePaths.get('promptAgent')?.status).toBe('suspended');
      // expect(initialResult.activePaths.get('promptAgent')?.suspendPayload).toMatchObject({ testPayload: 'hello' });
      expect(initialResult.steps).toMatchObject({
        input: { input: 'test' },
        getUserInput: { status: 'success', output: { userInput: 'test input' } },
        promptAgent: {
          status: 'suspended',
          suspendPayload: { testPayload: 'hello' },
          payload: { userInput: 'test input' },
        },
      });

      const newCtx = {
        userInput: 'test input for resumption',
      };

      expect(initialResult.steps.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);

      const firstResumeResult = await run.resume({ step: 'promptAgent', resumeData: newCtx });
      if (!firstResumeResult) {
        throw new Error('Resume failed to return a result');
      }

      // expect(firstResumeResult.activePaths.size).toBe(1);
      // expect(firstResumeResult.activePaths.get('improveResponse')?.status).toBe('suspended');
      expect(firstResumeResult.steps).toMatchObject({
        input: { input: 'test' },
        getUserInput: { status: 'success', output: { userInput: 'test input' } },
        promptAgent: { status: 'success', output: { modelOutput: 'test output' } },
        evaluateToneConsistency: {
          status: 'success',
          output: {
            toneScore: { score: 0.8 },
            completenessScore: { score: 0.7 },
          },
        },
        improveResponse: { status: 'suspended' },
      });

      const secondResumeResult = await run.resume({
        step: improveResponse,
        resumeData: {
          toneScore: { score: 0.8 },
          completenessScore: { score: 0.7 },
        },
      });

      srv.close();

      if (!secondResumeResult) {
        throw new Error('Resume failed to return a result');
      }

      expect(promptAgentAction).toHaveBeenCalledTimes(2);

      expect(secondResumeResult.steps).toMatchObject({
        input: { input: 'test' },
        getUserInput: { status: 'success', output: { userInput: 'test input' } },
        promptAgent: { status: 'success', output: { modelOutput: 'test output' } },
        evaluateToneConsistency: {
          status: 'success',
          output: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
        },
        improveResponse: { status: 'success', output: { improvedOutput: 'improved output' } },
        evaluateImprovedResponse: {
          status: 'success',
          output: { toneScore: { score: 0.9 }, completenessScore: { score: 0.8 } },
        },
      });

      expect(promptAgentAction).toHaveBeenCalledTimes(2);
    });

    it('should handle basic suspend and resume flow with async await syntax with state', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          return suspend({ testPayload: 'hello' });
        })
        .mockImplementationOnce(() => ({ modelOutput: 'test output' }));
      const evaluateToneAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.8 },
        completenessScore: { score: 0.7 },
      });
      const improveResponseAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend, state, setState }) => {
          setState({ ...state, value: 'test state' });
          await suspend();
          return undefined;
        })
        .mockImplementationOnce(() => ({ improvedOutput: 'improved output' }));
      const evaluateImprovedAction = vi.fn().mockImplementation(({ state }) => ({
        toneScore: { score: 0.9 },
        completenessScore: { score: 0.8 },
        value: state.value,
      }));

      const getUserInput = createStep({
        id: 'getUserInput',
        execute: getUserInputAction,
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ userInput: z.string() }),
      });
      const promptAgent = createStep({
        id: 'promptAgent',
        execute: promptAgentAction,
        inputSchema: z.object({ userInput: z.string() }),
        outputSchema: z.object({ modelOutput: z.string() }),
        suspendSchema: z.object({ testPayload: z.string() }),
        resumeSchema: z.object({ userInput: z.string() }),
      });
      const evaluateTone = createStep({
        id: 'evaluateToneConsistency',
        execute: evaluateToneAction,
        inputSchema: z.object({ modelOutput: z.string() }),
        outputSchema: z.object({
          toneScore: z.any(),
          completenessScore: z.any(),
        }),
      });
      const improveResponse = createStep({
        id: 'improveResponse',
        execute: improveResponseAction,
        resumeSchema: z.object({
          toneScore: z.object({ score: z.number() }),
          completenessScore: z.object({ score: z.number() }),
        }),
        inputSchema: z.object({ toneScore: z.any(), completenessScore: z.any() }),
        outputSchema: z.object({ improvedOutput: z.string() }),
      });
      const evaluateImproved = createStep({
        id: 'evaluateImprovedResponse',
        execute: evaluateImprovedAction,
        inputSchema: z.object({ improvedOutput: z.string() }),
        outputSchema: z.object({
          toneScore: z.any(),
          completenessScore: z.any(),
        }),
      });

      const promptEvalWorkflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({}),
      })
        .then(getUserInput)
        .then(promptAgent)
        .then(evaluateTone)
        .then(improveResponse)
        .then(evaluateImproved)
        .commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-workflow': promptEvalWorkflow,
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

      const run = await promptEvalWorkflow.createRun();

      const initialResult = await run.start({ inputData: { input: 'test' } });
      expect(initialResult.steps.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);
      // expect(initialResult.activePaths.size).toBe(1);
      // expect(initialResult.activePaths.get('promptAgent')?.status).toBe('suspended');
      // expect(initialResult.activePaths.get('promptAgent')?.suspendPayload).toEqual({ testPayload: 'hello' });
      expect(initialResult.steps).toEqual({
        input: { input: 'test' },
        getUserInput: {
          status: 'success',
          output: { userInput: 'test input' },
          payload: { input: 'test' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        promptAgent: {
          status: 'suspended',
          payload: { userInput: 'test input' },
          startedAt: expect.any(Number),
          suspendPayload: { testPayload: 'hello' },
          suspendedAt: expect.any(Number),
        },
      });

      const newCtx = {
        userInput: 'test input for resumption',
      };

      expect(initialResult.steps.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);

      const firstResumeResult = await run.resume({ step: 'promptAgent', resumeData: newCtx });
      if (!firstResumeResult) {
        throw new Error('Resume failed to return a result');
      }

      // expect(firstResumeResult.activePaths.size).toBe(1);
      // expect(firstResumeResult.activePaths.get('improveResponse')?.status).toBe('suspended');
      expect(firstResumeResult.steps).toEqual({
        input: { input: 'test' },
        getUserInput: {
          status: 'success',
          output: { userInput: 'test input' },
          payload: { input: 'test' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        promptAgent: {
          status: 'success',
          output: { modelOutput: 'test output' },
          payload: { userInput: 'test input' },
          resumePayload: { userInput: 'test input for resumption' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          resumedAt: expect.any(Number),
        },
        evaluateToneConsistency: {
          status: 'success',
          output: {
            toneScore: { score: 0.8 },
            completenessScore: { score: 0.7 },
          },
          payload: { modelOutput: 'test output' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        improveResponse: {
          status: 'suspended',
          payload: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
          startedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
        },
      });

      const secondResumeResult = await run.resume({
        step: improveResponse,
        resumeData: {
          toneScore: { score: 0.8 },
          completenessScore: { score: 0.7 },
        },
      });
      if (!secondResumeResult) {
        throw new Error('Resume failed to return a result');
      }

      expect(promptAgentAction).toHaveBeenCalledTimes(2);

      expect(secondResumeResult.steps).toEqual({
        input: { input: 'test' },
        getUserInput: {
          status: 'success',
          output: { userInput: 'test input' },
          payload: { input: 'test' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        promptAgent: {
          status: 'success',
          output: { modelOutput: 'test output' },
          payload: { userInput: 'test input' },
          resumePayload: { userInput: 'test input for resumption' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          resumedAt: expect.any(Number),
        },
        evaluateToneConsistency: {
          status: 'success',
          output: {
            toneScore: { score: 0.8 },
            completenessScore: { score: 0.7 },
          },
          payload: { modelOutput: 'test output' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        improveResponse: {
          status: 'success',
          output: { improvedOutput: 'improved output' },
          payload: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
          resumePayload: {
            toneScore: { score: 0.8 },
            completenessScore: { score: 0.7 },
          },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          resumedAt: expect.any(Number),
        },
        evaluateImprovedResponse: {
          status: 'success',
          output: { toneScore: { score: 0.9 }, completenessScore: { score: 0.8 }, value: 'test state' },
          payload: { improvedOutput: 'improved output' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });

      expect(promptAgentAction).toHaveBeenCalledTimes(2);

      srv.close();
    });

    it('should handle consecutive nested workflows with suspend/resume', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1 = vi.fn().mockImplementation(async ({ resumeData, suspend }) => {
        if (!resumeData?.suspect) {
          return await suspend({ message: 'What is the suspect?' });
        }
        return { suspect: resumeData.suspect };
      });
      const step1Definition = createStep({
        id: 'step-1',
        inputSchema: z.object({ suspect: z.string() }),
        outputSchema: z.object({ suspect: z.string() }),
        suspendSchema: z.object({ message: z.string() }),
        resumeSchema: z.object({ suspect: z.string() }),
        execute: step1,
      });

      const step2 = vi.fn().mockImplementation(async ({ resumeData, suspend }) => {
        if (!resumeData?.suspect) {
          return await suspend({ message: 'What is the second suspect?' });
        }
        return { suspect: resumeData.suspect };
      });
      const step2Definition = createStep({
        id: 'step-2',
        inputSchema: z.object({ suspect: z.string() }),
        outputSchema: z.object({ suspect: z.string() }),
        suspendSchema: z.object({ message: z.string() }),
        resumeSchema: z.object({ suspect: z.string() }),
        execute: step2,
      });

      const subWorkflow1 = createWorkflow({
        id: 'sub-workflow-1',
        inputSchema: z.object({ suspect: z.string() }),
        outputSchema: z.object({ suspect: z.string() }),
      })
        .then(step1Definition)
        .commit();

      const subWorkflow2 = createWorkflow({
        id: 'sub-workflow-2',
        inputSchema: z.object({ suspect: z.string() }),
        outputSchema: z.object({ suspect: z.string() }),
      })
        .then(step2Definition)
        .commit();

      const mainWorkflow = createWorkflow({
        id: 'main-workflow',
        inputSchema: z.object({ suspect: z.string() }),
        outputSchema: z.object({ suspect: z.string() }),
      })
        .then(subWorkflow1)
        .then(subWorkflow2)
        .commit();

      const mastra = new Mastra({
        logger: false,
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: { mainWorkflow },
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

      const run = await mainWorkflow.createRun();

      const initialResult = await run.start({ inputData: { suspect: 'initial-suspect' } });
      expect(initialResult.status).toBe('suspended');

      const firstResumeResult = await run.resume({
        step: ['sub-workflow-1', 'step-1'],
        resumeData: { suspect: 'first-suspect' },
      });
      expect(firstResumeResult.status).toBe('suspended');

      const secondResumeResult = await run.resume({
        step: ['sub-workflow-2', 'step-2'],
        resumeData: { suspect: 'second-suspect' },
      });

      expect(step1).toHaveBeenCalledTimes(2);
      expect(step2).toHaveBeenCalledTimes(2);
      expect(secondResumeResult.status).toBe('success');
      expect(secondResumeResult.steps['sub-workflow-1']).toMatchObject({
        status: 'success',
      });
      expect(secondResumeResult.steps['sub-workflow-2']).toMatchObject({
        status: 'success',
      });

      srv.close();
    });

    it('should maintain correct step status after resuming in branching workflows - #6419', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const branchStep1 = createStep({
        id: 'branch-step-1',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ result: z.number() }),
        resumeSchema: z.object({ multiplier: z.number() }),
        execute: async ({ inputData, suspend, resumeData }) => {
          if (!resumeData) {
            await suspend({});
            return { result: 0 };
          }
          return { result: inputData.value * resumeData.multiplier };
        },
      });

      const branchStep2 = createStep({
        id: 'branch-step-2',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ result: z.number() }),
        resumeSchema: z.object({ multiplier: z.number() }),
        execute: async ({ inputData, suspend, resumeData }) => {
          if (!resumeData) {
            return suspend({});
          }
          return { result: inputData.value * resumeData.multiplier };
        },
      });

      const testWorkflow = createWorkflow({
        id: 'branching-state-bug-test',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({
          'branch-step-1': z.object({ result: z.number() }),
          'branch-step-2': z.object({ result: z.number() }),
        }),
        options: { validateInputs: false },
      })
        .branch([
          [async () => true, branchStep1], // First branch will execute and suspend
          [async () => true, branchStep2], // Second branch will execute and suspend
        ])
        .commit();

      // Create a new storage instance for initial run
      const initialStorage = new DefaultStorage({
        id: 'test-storage',
        url: 'file::memory:',
      });
      const mastra = new Mastra({
        storage: initialStorage,
        workflows: {
          'test-workflow': testWorkflow,
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

      const run = await testWorkflow.createRun();

      // Start workflow - both steps should suspend
      const initialResult = await run.start({ inputData: { value: 10 } });

      expect(initialResult.status).toBe('suspended');
      expect(initialResult.steps['branch-step-1'].status).toBe('suspended');
      expect(initialResult.steps['branch-step-2'].status).toBe('suspended');
      expect(initialResult.steps['branch-step-1'].suspendOutput).toMatchObject({ result: 0 });
      expect(initialResult.steps['branch-step-2'].suspendOutput).toBeUndefined();
      if (initialResult.status === 'suspended') {
        expect(initialResult.suspended).toHaveLength(2);
        expect(initialResult.suspended[0]).toContain('branch-step-1');
        expect(initialResult.suspended[1]).toContain('branch-step-2');
      }

      const resumedResult1 = await run.resume({
        step: 'branch-step-1',
        resumeData: { multiplier: 2 },
      });
      // Workflow should still be suspended (branch-step-2 not resumed yet)
      expect(resumedResult1.status).toBe('suspended');
      expect(resumedResult1.steps['branch-step-1'].status).toBe('success');
      expect(resumedResult1.steps['branch-step-2'].status).toBe('suspended');
      if (resumedResult1.status === 'suspended') {
        expect(resumedResult1.suspended).toHaveLength(1);
        expect(resumedResult1.suspended[0]).toContain('branch-step-2');
      }

      const finalResult = await run.resume({
        step: 'branch-step-2',
        resumeData: { multiplier: 3 },
      });

      srv.close();

      expect(finalResult.status).toBe('success');
      expect(finalResult.steps['branch-step-1'].status).toBe('success');
      expect(finalResult.steps['branch-step-2'].status).toBe('success');
      if (finalResult.status === 'success') {
        expect(finalResult.result).toEqual({
          'branch-step-1': { result: 20 }, // 10 * 2
          'branch-step-2': { result: 30 }, // 10 * 3
        });
      }
    });
  });

  describe('Time travel', () => {
    const testStorage = new MockStore();
    afterEach(async () => {
      await testStorage.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
    });

    it('should throw error if trying to timetravel a workflow execution that is still running', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const execute = vi.fn<any>().mockResolvedValue({ step1Result: 2 });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ step1Result: z.number() }),
      });

      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          return {
            step2Result: inputData.step1Result + 1,
          };
        },
        inputSchema: z.object({ step1Result: z.number() }),
        outputSchema: z.object({ step2Result: z.number() }),
      });

      const step3 = createStep({
        id: 'step3',
        execute: async ({ inputData }) => {
          return {
            final: inputData.step2Result + 1,
          };
        },
        inputSchema: z.object({ step2Result: z.number() }),
        outputSchema: z.object({ final: z.number() }),
      });

      const workflow = createWorkflow({
        id: 'testWorkflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({
          final: z.number(),
        }),
        steps: [step1, step2, step3],
      });

      workflow.then(step1).then(step2).then(step3).commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { testWorkflow: workflow },
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

      await testStorage.persistWorkflowSnapshot({
        workflowName: 'testWorkflow',
        runId,
        snapshot: {
          runId,
          status: 'running',
          activePaths: [1],
          activeStepsPath: { step2: [1] },
          value: {},
          context: {
            input: { value: 0 },
            step1: {
              payload: { value: 0 },
              startedAt: Date.now(),
              status: 'success',
              output: { step1Result: 2 },
              endedAt: Date.now(),
            },
            step2: {
              payload: { step1Result: 2 },
              startedAt: Date.now(),
              status: 'running',
            },
          } as any,
          serializedStepGraph: workflow.serializedStepGraph as any,
          suspendedPaths: {},
          waitingPaths: {},
          resumeLabels: {},
          timestamp: Date.now(),
        },
      });

      const run = await workflow.createRun({ runId });

      await expect(run.timeTravel({ step: 'step2', inputData: { step1Result: 2 } })).rejects.toThrow(
        'This workflow run is still running, cannot time travel',
      );

      srv.close();
    });

    it('should throw error if validateInputs is true and trying to timetravel a workflow execution with invalid inputData', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const execute = vi.fn<any>().mockResolvedValue({ step1Result: 2 });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ step1Result: z.number() }),
      });

      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          return {
            step2Result: inputData.step1Result + 1,
          };
        },
        inputSchema: z.object({ step1Result: z.number() }),
        outputSchema: z.object({ step2Result: z.number() }),
      });

      const step3 = createStep({
        id: 'step3',
        execute: async ({ inputData }) => {
          return {
            final: inputData.step2Result + 1,
          };
        },
        inputSchema: z.object({ step2Result: z.number() }),
        outputSchema: z.object({ final: z.number() }),
      });

      const workflow = createWorkflow({
        id: 'testWorkflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({
          final: z.number(),
        }),
        steps: [step1, step2, step3],
        options: {
          validateInputs: true,
        },
      });

      workflow.then(step1).then(step2).then(step3).commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { testWorkflow: workflow },
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

      await expect(run.timeTravel({ step: 'step2', inputData: { invalidPayload: 2 } })).rejects.toThrow(
        'Invalid inputData: \n- step1Result: Required',
      );

      srv.close();
    });

    it('should throw error if trying to timetravel to a non-existent step', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const execute = vi.fn<any>().mockResolvedValue({ step1Result: 2 });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ step1Result: z.number() }),
      });

      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          return {
            step2Result: inputData.step1Result + 1,
          };
        },
        inputSchema: z.object({ step1Result: z.number() }),
        outputSchema: z.object({ step2Result: z.number() }),
      });

      const step3 = createStep({
        id: 'step3',
        execute: async ({ inputData }) => {
          return {
            final: inputData.step2Result + 1,
          };
        },
        inputSchema: z.object({ step2Result: z.number() }),
        outputSchema: z.object({ final: z.number() }),
      });

      const workflow = createWorkflow({
        id: 'testWorkflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({
          final: z.number(),
        }),
      });

      workflow.then(step1).then(step2).then(step3).commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { testWorkflow: workflow },
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

      await expect(run.timeTravel({ step: 'step4', inputData: { step1Result: 2 } })).rejects.toThrow(
        "Time travel target step not found in execution graph: 'step4'. Verify the step id/path.",
      );

      srv.close();
    });

    it('should timeTravel a workflow execution', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const execute = vi.fn<any>().mockResolvedValue({ step1Result: 2 });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ step1Result: z.number() }),
      });

      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          return {
            step2Result: inputData.step1Result + 1,
          };
        },
        inputSchema: z.object({ step1Result: z.number() }),
        outputSchema: z.object({ step2Result: z.number() }),
      });

      const step3 = createStep({
        id: 'step3',
        execute: async ({ inputData }) => {
          return {
            final: inputData.step2Result + 1,
          };
        },
        inputSchema: z.object({ step2Result: z.number() }),
        outputSchema: z.object({ final: z.number() }),
      });

      const workflow = createWorkflow({
        id: 'testWorkflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({
          final: z.number(),
        }),
        steps: [step1, step2, step3],
      });

      workflow.then(step1).then(step2).then(step3).commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { testWorkflow: workflow },
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
      const result = await run.timeTravel({
        step: step2,
        context: {
          step1: {
            payload: { value: 0 },
            startedAt: Date.now(),
            status: 'success',
            output: { step1Result: 2 },
            endedAt: Date.now(),
          },
        },
      });

      expect(result.status).toBe('success');
      expect(result).toEqual({
        status: 'success',
        steps: {
          input: {
            value: 0,
          },
          step1: {
            payload: {
              value: 0,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              step1Result: 2,
            },
            endedAt: expect.any(Number),
          },
          step2: {
            payload: {
              step1Result: 2,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              step2Result: 3,
            },
            endedAt: expect.any(Number),
          },
          step3: {
            payload: {
              step2Result: 3,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              final: 4,
            },
            endedAt: expect.any(Number),
          },
        },
        result: {
          final: 4,
        },
      });

      expect(execute).toHaveBeenCalledTimes(0);

      const run2 = await workflow.createRun();
      const result2 = await run2.timeTravel({
        step: 'step2',
        inputData: { step1Result: 2 },
      });

      expect(result2.status).toBe('success');
      expect(result2).toEqual({
        status: 'success',
        steps: {
          input: {},
          step1: {
            payload: {},
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              step1Result: 2,
            },
            endedAt: expect.any(Number),
          },
          step2: {
            payload: {
              step1Result: 2,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              step2Result: 3,
            },
            endedAt: expect.any(Number),
          },
          step3: {
            payload: {
              step2Result: 3,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              final: 4,
            },
            endedAt: expect.any(Number),
          },
        },
        result: {
          final: 4,
        },
      });

      expect(execute).toHaveBeenCalledTimes(0);

      srv.close();
    });

    it('should timeTravel a workflow execution that was previously ran', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const execute = vi.fn<any>().mockResolvedValue({ step1Result: 2 });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ step1Result: z.number() }),
      });

      const step2 = createStep({
        id: 'step2',
        execute: async ({ inputData }) => {
          if (inputData.step1Result < 3) {
            throw new Error('Simulated error');
          }
          return {
            step2Result: inputData.step1Result + 1,
          };
        },
        inputSchema: z.object({ step1Result: z.number() }),
        outputSchema: z.object({ step2Result: z.number() }),
      });

      const step3 = createStep({
        id: 'step3',
        execute: async ({ inputData }) => {
          return {
            final: inputData.step2Result + 1,
          };
        },
        inputSchema: z.object({ step2Result: z.number() }),
        outputSchema: z.object({ final: z.number() }),
      });

      const workflow = createWorkflow({
        id: 'testWorkflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({
          final: z.number(),
        }),
        steps: [step1, step2, step3],
        options: { validateInputs: false },
      });

      workflow.then(step1).then(step2).then(step3).commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { testWorkflow: workflow },
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
      const failedRun = await run.start({ inputData: { value: 0 } });
      expect(failedRun.status).toBe('failed');
      expect(failedRun.steps.step2).toEqual({
        status: 'failed',
        payload: { step1Result: 2 },
        error: 'Simulated error',
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      const result = await run.timeTravel({
        step: step2,
        context: {
          step1: {
            payload: failedRun.steps.step1.payload,
            startedAt: Date.now(),
            status: 'success',
            output: { step1Result: 3 },
            endedAt: Date.now(),
          },
        },
      });

      expect(result.status).toBe('success');
      expect(result).toEqual({
        status: 'success',
        steps: {
          input: {
            value: 0,
          },
          step1: {
            payload: {
              value: 0,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              step1Result: 3,
            },
            endedAt: expect.any(Number),
          },
          step2: {
            payload: {
              step1Result: 3,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              step2Result: 4,
            },
            endedAt: expect.any(Number),
          },
          step3: {
            payload: {
              step2Result: 4,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              final: 5,
            },
            endedAt: expect.any(Number),
          },
        },
        result: {
          final: 5,
        },
      });

      expect(execute).toHaveBeenCalledTimes(1);

      const result2 = await run.timeTravel({
        step: 'step2',
        inputData: { step1Result: 4 },
      });

      expect(result2.status).toBe('success');
      expect(result2).toEqual({
        status: 'success',
        steps: {
          input: { value: 0 },
          step1: {
            payload: { value: 0 },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              step1Result: 4,
            },
            endedAt: expect.any(Number),
          },
          step2: {
            payload: {
              step1Result: 4,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              step2Result: 5,
            },
            endedAt: expect.any(Number),
          },
          step3: {
            payload: {
              step2Result: 5,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              final: 6,
            },
            endedAt: expect.any(Number),
          },
        },
        result: {
          final: 6,
        },
      });

      expect(execute).toHaveBeenCalledTimes(1);

      srv.close();
    });

    it('should timeTravel a workflow execution that has nested workflows', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const execute = vi.fn<any>().mockResolvedValue({ step1Result: 2 });
      const executeStep2 = vi.fn<any>().mockResolvedValue({ step2Result: 3 });
      const step1 = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ step1Result: z.number() }),
      });

      const step2 = createStep({
        id: 'step2',
        execute: executeStep2,
        inputSchema: z.object({ step1Result: z.number() }),
        outputSchema: z.object({ step2Result: z.number() }),
      });

      const step3 = createStep({
        id: 'step3',
        execute: async ({ inputData }) => {
          return {
            nestedFinal: inputData.step2Result + 1,
          };
        },
        inputSchema: z.object({ step2Result: z.number() }),
        outputSchema: z.object({ nestedFinal: z.number() }),
      });

      const step4 = createStep({
        id: 'step4',
        execute: async ({ inputData }) => {
          return {
            final: inputData.nestedFinal + 1,
          };
        },
        inputSchema: z.object({ nestedFinal: z.number() }),
        outputSchema: z.object({ final: z.number() }),
      });

      const nestedWorkflow = createWorkflow({
        id: 'nestedWorkflow',
        inputSchema: z.object({ step1Result: z.number() }),
        outputSchema: z.object({
          nestedFinal: z.number(),
        }),
        steps: [step2, step3],
      })
        .then(step2)
        .then(step3)
        .commit();

      const workflow = createWorkflow({
        id: 'testWorkflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({
          final: z.number(),
        }),
      })
        .then(step1)
        .then(nestedWorkflow)
        .then(step4)
        .commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { testWorkflow: workflow },
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
      const result = await run.timeTravel({
        step: 'nestedWorkflow.step3',
        context: {
          step1: {
            payload: { value: 0 },
            startedAt: Date.now(),
            status: 'success',
            output: { step1Result: 2 },
            endedAt: Date.now(),
          },
        },
        nestedStepsContext: {
          nestedWorkflow: {
            step2: {
              payload: { step1Result: 2 },
              startedAt: Date.now(),
              status: 'success',
              output: { step2Result: 3 },
              endedAt: Date.now(),
            },
          },
        },
      });

      expect(result.status).toBe('success');
      expect(result).toEqual({
        status: 'success',
        steps: {
          input: { value: 0 },
          step1: {
            payload: {
              value: 0,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              step1Result: 2,
            },
            endedAt: expect.any(Number),
          },
          nestedWorkflow: {
            payload: {
              step1Result: 2,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              nestedFinal: 4,
            },
            endedAt: expect.any(Number),
          },
          step4: {
            payload: {
              nestedFinal: 4,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              final: 5,
            },
            endedAt: expect.any(Number),
          },
        },
        result: {
          final: 5,
        },
      });

      expect(execute).toHaveBeenCalledTimes(0);
      expect(executeStep2).toHaveBeenCalledTimes(0);

      const run2 = await workflow.createRun();
      const result2 = await run2.timeTravel({
        step: [nestedWorkflow, step3],
        inputData: { step2Result: 3 },
      });

      expect(result2.status).toBe('success');
      expect(result2).toEqual({
        status: 'success',
        steps: {
          input: {},
          step1: {
            payload: {},
            startedAt: expect.any(Number),
            status: 'success',
            output: {},
            endedAt: expect.any(Number),
          },
          nestedWorkflow: {
            payload: {},
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              nestedFinal: 4,
            },
            endedAt: expect.any(Number),
          },
          step4: {
            payload: {
              nestedFinal: 4,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              final: 5,
            },
            endedAt: expect.any(Number),
          },
        },
        result: {
          final: 5,
        },
      });

      expect(execute).toHaveBeenCalledTimes(0);
      expect(executeStep2).toHaveBeenCalledTimes(0);

      const run3 = await workflow.createRun();
      const result3 = await run3.timeTravel({
        step: 'nestedWorkflow',
        inputData: { step1Result: 2 },
      });

      expect(result3.status).toBe('success');
      expect(result3).toEqual({
        status: 'success',
        steps: {
          input: {},
          step1: {
            payload: {},
            startedAt: expect.any(Number),
            status: 'success',
            output: { step1Result: 2 },
            endedAt: expect.any(Number),
          },
          nestedWorkflow: {
            payload: { step1Result: 2 },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              nestedFinal: 4,
            },
            endedAt: expect.any(Number),
          },
          step4: {
            payload: {
              nestedFinal: 4,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              final: 5,
            },
            endedAt: expect.any(Number),
          },
        },
        result: {
          final: 5,
        },
      });

      expect(execute).toHaveBeenCalledTimes(0);
      expect(executeStep2).toHaveBeenCalledTimes(1);

      srv.close();
    });

    it('should successfully suspend and resume a timeTravelled workflow execution', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          return suspend({ testPayload: 'hello' });
        })
        .mockImplementationOnce(() => ({ modelOutput: 'test output' }));
      const evaluateToneAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.8 },
        completenessScore: { score: 0.7 },
      });
      const improveResponseAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          await suspend();
          return undefined;
        })
        .mockImplementationOnce(() => ({ improvedOutput: 'improved output' }));
      const evaluateImprovedAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.9 },
        completenessScore: { score: 0.8 },
      });

      const getUserInput = createStep({
        id: 'getUserInput',
        execute: getUserInputAction,
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ userInput: z.string() }),
      });
      const promptAgent = createStep({
        id: 'promptAgent',
        execute: promptAgentAction,
        inputSchema: z.object({ userInput: z.string() }),
        outputSchema: z.object({ modelOutput: z.string() }),
        suspendSchema: z.object({ testPayload: z.string() }),
        resumeSchema: z.object({ userInput: z.string() }),
      });
      const evaluateTone = createStep({
        id: 'evaluateToneConsistency',
        execute: evaluateToneAction,
        inputSchema: z.object({ modelOutput: z.string() }),
        outputSchema: z.object({
          toneScore: z.any(),
          completenessScore: z.any(),
        }),
      });
      const improveResponse = createStep({
        id: 'improveResponse',
        execute: improveResponseAction,
        resumeSchema: z.object({
          toneScore: z.object({ score: z.number() }),
          completenessScore: z.object({ score: z.number() }),
        }),
        inputSchema: z.object({ toneScore: z.any(), completenessScore: z.any() }),
        outputSchema: z.object({ improvedOutput: z.string() }),
      });
      const evaluateImproved = createStep({
        id: 'evaluateImprovedResponse',
        execute: evaluateImprovedAction,
        inputSchema: z.object({ improvedOutput: z.string() }),
        outputSchema: z.object({
          toneScore: z.any(),
          completenessScore: z.any(),
        }),
      });

      const promptEvalWorkflow = createWorkflow({
        id: 'promptEvalWorkflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({}),
      });

      promptEvalWorkflow
        .then(getUserInput)
        .then(promptAgent)
        .then(evaluateTone)
        .then(improveResponse)
        .then(evaluateImproved)
        .commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { promptEvalWorkflow },
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

      const run = await promptEvalWorkflow.createRun();

      const initialResult = await run.timeTravel({
        step: 'promptAgent',
        inputData: { userInput: 'test input' },
      });
      expect(initialResult.steps.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);
      expect(initialResult.steps).toEqual({
        input: {},
        getUserInput: {
          status: 'success',
          output: { userInput: 'test input' },
          payload: {},
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        promptAgent: {
          status: 'suspended',
          payload: { userInput: 'test input' },
          suspendPayload: { testPayload: 'hello' },
          startedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
        },
      });

      const newCtx = {
        userInput: 'test input for resumption',
      };

      expect(initialResult.steps.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);

      const firstResumeResult = await run.resume({ step: 'promptAgent', resumeData: newCtx });
      if (!firstResumeResult) {
        throw new Error('Resume failed to return a result');
      }

      expect(firstResumeResult.steps).toEqual({
        input: {},
        getUserInput: {
          status: 'success',
          output: { userInput: 'test input' },
          payload: {},
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        promptAgent: {
          status: 'success',
          output: { modelOutput: 'test output' },
          payload: { userInput: 'test input' },
          resumePayload: { userInput: 'test input for resumption' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          resumedAt: expect.any(Number),
        },
        evaluateToneConsistency: {
          status: 'success',
          output: {
            toneScore: { score: 0.8 },
            completenessScore: { score: 0.7 },
          },
          payload: { modelOutput: 'test output' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        improveResponse: {
          status: 'suspended',
          payload: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
          startedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
        },
      });

      expect(getUserInputAction).toHaveBeenCalledTimes(0);

      srv.close();
    });

    it('should timetravel a suspended workflow execution', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          return suspend({ testPayload: 'hello' });
        })
        .mockImplementationOnce(() => ({ modelOutput: 'test output' }));
      const evaluateToneAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.8 },
        completenessScore: { score: 0.7 },
      });
      const improveResponseAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          await suspend();
          return undefined;
        })
        .mockImplementationOnce(() => ({ improvedOutput: 'improved output' }));
      const evaluateImprovedAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.9 },
        completenessScore: { score: 0.8 },
      });

      const getUserInput = createStep({
        id: 'getUserInput',
        execute: getUserInputAction,
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ userInput: z.string() }),
      });
      const promptAgent = createStep({
        id: 'promptAgent',
        execute: promptAgentAction,
        inputSchema: z.object({ userInput: z.string() }),
        outputSchema: z.object({ modelOutput: z.string() }),
        suspendSchema: z.object({ testPayload: z.string() }),
        resumeSchema: z.object({ userInput: z.string() }),
      });
      const evaluateTone = createStep({
        id: 'evaluateToneConsistency',
        execute: evaluateToneAction,
        inputSchema: z.object({ modelOutput: z.string() }),
        outputSchema: z.object({
          toneScore: z.any(),
          completenessScore: z.any(),
        }),
      });
      const improveResponse = createStep({
        id: 'improveResponse',
        execute: improveResponseAction,
        resumeSchema: z.object({
          toneScore: z.object({ score: z.number() }),
          completenessScore: z.object({ score: z.number() }),
        }),
        inputSchema: z.object({ toneScore: z.any(), completenessScore: z.any() }),
        outputSchema: z.object({ improvedOutput: z.string() }),
      });
      const evaluateImproved = createStep({
        id: 'evaluateImprovedResponse',
        execute: evaluateImprovedAction,
        inputSchema: z.object({ improvedOutput: z.string() }),
        outputSchema: z.object({
          toneScore: z.any(),
          completenessScore: z.any(),
        }),
      });

      const promptEvalWorkflow = createWorkflow({
        id: 'promptEvalWorkflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({}),
      });

      promptEvalWorkflow
        .then(getUserInput)
        .then(promptAgent)
        .then(evaluateTone)
        .then(improveResponse)
        .then(evaluateImproved)
        .commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { promptEvalWorkflow },
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

      const run = await promptEvalWorkflow.createRun();

      const initialResult = await run.start({
        inputData: { input: 'test input' },
      });
      expect(initialResult.steps.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);
      expect(initialResult.steps).toEqual({
        input: { input: 'test input' },
        getUserInput: {
          status: 'success',
          output: { userInput: 'test input' },
          payload: { input: 'test input' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        promptAgent: {
          status: 'suspended',
          payload: { userInput: 'test input' },
          suspendPayload: { testPayload: 'hello' },
          startedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
        },
      });

      expect(initialResult.steps.promptAgent.status).toBe('suspended');
      expect(promptAgentAction).toHaveBeenCalledTimes(1);

      const timeTravelResult = await run.timeTravel({
        step: 'getUserInput',
        resumeData: {
          userInput: 'test input for resumption',
        },
      });
      if (!timeTravelResult) {
        throw new Error('Resume failed to return a result');
      }

      expect(timeTravelResult.steps).toEqual({
        input: { input: 'test input' },
        getUserInput: {
          status: 'success',
          output: { userInput: 'test input' },
          payload: { input: 'test input' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        promptAgent: {
          status: 'success',
          output: { modelOutput: 'test output' },
          payload: { userInput: 'test input' },
          resumePayload: { userInput: 'test input for resumption' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          resumedAt: expect.any(Number),
        },
        evaluateToneConsistency: {
          status: 'success',
          output: {
            toneScore: { score: 0.8 },
            completenessScore: { score: 0.7 },
          },
          payload: { modelOutput: 'test output' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        improveResponse: {
          status: 'suspended',
          payload: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
          startedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
        },
      });

      expect(getUserInputAction).toHaveBeenCalledTimes(2);
      expect(promptAgentAction).toHaveBeenCalledTimes(2);

      srv.close();
    });

    it('should timeTravel workflow execution for a do-until workflow', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const incrementStep = createStep({
        id: 'increment',
        inputSchema: z.object({
          value: z.number(),
        }),
        outputSchema: z.object({
          value: z.number(),
        }),
        execute: async ({ inputData }) => {
          return {
            value: inputData.value + 1,
          };
        },
      });

      const firstStep = createStep({
        id: 'first-step',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
        execute: async ({ inputData }) => {
          return inputData;
        },
      });

      const dowhileWorkflow = createWorkflow({
        id: 'dowhile-workflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
      })
        .then(firstStep)
        .dountil(incrementStep, async ({ inputData }) => {
          return inputData.value >= 10;
        })
        .then(
          createStep({
            id: 'final',
            inputSchema: z.object({ value: z.number() }),
            outputSchema: z.object({ value: z.number() }),
            execute: async ({ inputData }) => ({ value: inputData.value }),
          }),
        )
        .commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'dowhile-workflow': dowhileWorkflow },
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

      const run = await dowhileWorkflow.createRun();
      const result = await run.timeTravel({
        step: 'increment',
        context: {
          'first-step': {
            status: 'success',
            payload: {
              value: 0,
            },
            output: {
              value: 0,
            },
            startedAt: Date.now(),
            endedAt: Date.now(),
          },
          increment: {
            payload: { value: 5 },
            startedAt: Date.now(),
            status: 'running',
            output: { value: 6 },
            endedAt: Date.now(),
          },
        },
      });
      expect(result).toEqual({
        status: 'success',
        steps: {
          input: {
            value: 0,
          },
          'first-step': {
            status: 'success',
            payload: {
              value: 0,
            },
            output: {
              value: 0,
            },
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          increment: {
            payload: {
              value: 9,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              value: 10,
            },
            endedAt: expect.any(Number),
          },
          final: {
            payload: {
              value: 10,
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              value: 10,
            },
            endedAt: expect.any(Number),
          },
        },
        result: {
          value: 10,
        },
      });

      srv.close();
    });

    //parallel steps tests seem to be failing in inngest
    it('should timeTravel workflow execution for workflow with parallel steps', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const initialStepAction = vi.fn().mockImplementation(async () => {
        return { result: 'initial step done' };
      });

      const nextStepAction = vi.fn().mockImplementation(async () => {
        return { result: 'next step done' };
      });

      const parallelStep1Action = vi.fn().mockImplementation(async () => {
        return { result: 'parallelStep1 done' };
      });

      const parallelStep2Action = vi.fn().mockImplementation(async () => {
        return { result: 'parallelStep2 done' };
      });

      const parallelStep3Action = vi.fn().mockImplementation(async () => {
        return { result: 'parallelStep3 done' };
      });

      const finalStepAction = vi.fn().mockImplementation(async () => {
        return { result: 'All done!' };
      });

      // Create steps
      const initialStep = createStep({
        id: 'initialStep',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: initialStepAction,
      });

      const nextStep = createStep({
        id: 'nextStep',
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: nextStepAction,
      });

      const parallelStep1 = createStep({
        id: 'parallelStep1',
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: parallelStep1Action,
      });

      const parallelStep2 = createStep({
        id: 'parallelStep2',
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: parallelStep2Action,
      });

      const parallelStep3 = createStep({
        id: 'parallelStep3',
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: parallelStep3Action,
      });

      const finalStep = createStep({
        id: 'finalStep',
        inputSchema: z.object({
          parallelStep1: z.object({ result: z.string() }),
          parallelStep2: z.object({ result: z.string() }),
          parallelStep3: z.object({ result: z.string() }),
        }),
        outputSchema: z.object({ result: z.string() }),
        execute: finalStepAction,
      });

      // Create workflow
      const testParallelWorkflow = createWorkflow({
        id: 'test-parallel-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      })
        .then(initialStep)
        .then(nextStep)
        .parallel([parallelStep1, parallelStep2, parallelStep3])
        .then(finalStep)
        .commit();

      // Initialize Mastra with testStorage
      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { 'test-parallel-workflow': testParallelWorkflow },
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

      const run = await testParallelWorkflow.createRun();

      const result = await run.timeTravel({
        step: 'nextStep',
        inputData: {
          result: 'initial step done',
        },
      });

      expect(result.status).toBe('success');
      expect(result).toEqual({
        status: 'success',
        steps: {
          input: {},
          initialStep: {
            status: 'success',
            payload: {},
            output: {
              result: 'initial step done',
            },
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          nextStep: {
            status: 'success',
            payload: { result: 'initial step done' },
            output: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          parallelStep1: {
            payload: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              result: 'parallelStep1 done',
            },
            endedAt: expect.any(Number),
          },
          parallelStep2: {
            payload: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              result: 'parallelStep2 done',
            },
            endedAt: expect.any(Number),
          },
          parallelStep3: {
            payload: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              result: 'parallelStep3 done',
            },
            endedAt: expect.any(Number),
          },
          finalStep: {
            payload: {
              parallelStep1: { result: 'parallelStep1 done' },
              parallelStep2: { result: 'parallelStep2 done' },
              parallelStep3: { result: 'parallelStep3 done' },
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: { result: 'All done!' },
            endedAt: expect.any(Number),
          },
        },
        result: {
          result: 'All done!',
        },
      });

      expect(initialStepAction).toHaveBeenCalledTimes(0);
      expect(nextStepAction).toHaveBeenCalledTimes(1);
      expect(parallelStep1Action).toHaveBeenCalledTimes(1);
      expect(parallelStep2Action).toHaveBeenCalledTimes(1);
      expect(parallelStep3Action).toHaveBeenCalledTimes(1);
      expect(finalStepAction).toHaveBeenCalledTimes(1);

      const run2 = await testParallelWorkflow.createRun();
      const result2 = await run2.timeTravel({
        step: 'parallelStep2',
        context: {
          initialStep: {
            status: 'success',
            payload: { input: 'start' },
            output: {
              result: 'initial step done',
            },
            startedAt: Date.now(),
            endedAt: Date.now(),
          },
          nextStep: {
            status: 'success',
            payload: { result: 'initial step done' },
            output: {
              result: 'next step done',
            },
            startedAt: Date.now(),
            endedAt: Date.now(),
          },
          parallelStep1: {
            payload: {
              result: 'next step done',
            },
            startedAt: Date.now(),
            status: 'success',
            output: {
              result: 'parallelStep1 done',
            },
            endedAt: Date.now(),
          },
          parallelStep3: {
            payload: {
              result: 'next step done',
            },
            startedAt: Date.now(),
            status: 'success',
            output: {
              result: 'parallelStep3 done',
            },
            endedAt: Date.now(),
          },
        },
      });

      expect(result2.status).toBe('success');
      expect(result2).toEqual({
        status: 'success',
        steps: {
          input: { input: 'start' },
          initialStep: {
            status: 'success',
            payload: { input: 'start' },
            output: {
              result: 'initial step done',
            },
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          nextStep: {
            status: 'success',
            payload: { result: 'initial step done' },
            output: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          parallelStep1: {
            payload: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              result: 'parallelStep1 done',
            },
            endedAt: expect.any(Number),
          },
          parallelStep2: {
            payload: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              result: 'parallelStep2 done',
            },
            endedAt: expect.any(Number),
          },
          parallelStep3: {
            payload: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              result: 'parallelStep3 done',
            },
            endedAt: expect.any(Number),
          },
          finalStep: {
            payload: {
              parallelStep1: { result: 'parallelStep1 done' },
              parallelStep2: { result: 'parallelStep2 done' },
              parallelStep3: { result: 'parallelStep3 done' },
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: { result: 'All done!' },
            endedAt: expect.any(Number),
          },
        },
        result: {
          result: 'All done!',
        },
      });

      expect(initialStepAction).toHaveBeenCalledTimes(0);
      expect(nextStepAction).toHaveBeenCalledTimes(1);
      expect(parallelStep1Action).toHaveBeenCalledTimes(1);
      expect(parallelStep2Action).toHaveBeenCalledTimes(2);
      expect(parallelStep3Action).toHaveBeenCalledTimes(1);
      expect(finalStepAction).toHaveBeenCalledTimes(2);

      const run3 = await testParallelWorkflow.createRun();
      const result3 = await run3.timeTravel({
        step: 'parallelStep2',
        inputData: {
          result: 'next step done',
        },
      });

      expect(result3.status).toBe('success');
      expect(result3).toEqual({
        status: 'success',
        steps: {
          input: {},
          initialStep: {
            status: 'success',
            payload: {},
            output: {},
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          nextStep: {
            status: 'success',
            payload: {},
            output: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          parallelStep1: {
            payload: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {},
            endedAt: expect.any(Number),
          },
          parallelStep2: {
            payload: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {
              result: 'parallelStep2 done',
            },
            endedAt: expect.any(Number),
          },
          parallelStep3: {
            payload: {
              result: 'next step done',
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: {},
            endedAt: expect.any(Number),
          },
          finalStep: {
            payload: {
              parallelStep1: {},
              parallelStep2: { result: 'parallelStep2 done' },
              parallelStep3: {},
            },
            startedAt: expect.any(Number),
            status: 'success',
            output: { result: 'All done!' },
            endedAt: expect.any(Number),
          },
        },
        result: {
          result: 'All done!',
        },
      });

      expect(initialStepAction).toHaveBeenCalledTimes(0);
      expect(nextStepAction).toHaveBeenCalledTimes(1);
      expect(parallelStep1Action).toHaveBeenCalledTimes(1);
      expect(parallelStep2Action).toHaveBeenCalledTimes(3);
      expect(parallelStep3Action).toHaveBeenCalledTimes(1);
      expect(finalStepAction).toHaveBeenCalledTimes(3);

      srv.close();
    });
  });

  describe('Agent as step', () => {
    it('should be able to use an agent as a step', async ctx => {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not set');
      }

      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({
          prompt1: z.string(),
          prompt2: z.string(),
        }),
        outputSchema: z.object({}),
      });

      const agent = new Agent({
        id: 'test-agent-1',
        name: 'test-agent-1',
        instructions: 'test agent instructions',
        model: openai('gpt-4'),
      });

      const agent2 = new Agent({
        id: 'test-agent-2',
        name: 'test-agent-2',
        instructions: 'test agent instructions',
        model: openai('gpt-4'),
      });

      const startStep = createStep({
        id: 'start',
        inputSchema: z.object({
          prompt1: z.string(),
          prompt2: z.string(),
        }),
        outputSchema: z.object({ prompt1: z.string(), prompt2: z.string() }),
        execute: async ({ inputData }) => {
          return {
            prompt1: inputData.prompt1,
            prompt2: inputData.prompt2,
          };
        },
      });

      const agentStep1 = createStep(agent);
      const agentStep2 = createStep(agent2);

      workflow
        .then(startStep)
        .map({
          prompt: {
            step: startStep,
            path: 'prompt1',
          },
        })
        .then(agentStep1)
        .map({
          prompt: {
            step: startStep,
            path: 'prompt2',
          },
        })
        .then(agentStep2)
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
      const result = await run.start({
        inputData: { prompt1: 'Capital of France, just the name', prompt2: 'Capital of UK, just the name' },
      });

      srv.close();

      expect(result.steps['test-agent-1']).toMatchObject({
        status: 'success',
        output: { text: 'Paris' },
      });

      expect(result.steps['test-agent-2']).toMatchObject({
        status: 'success',
        output: { text: 'London' },
      });
    });

    it('should be able to use an agent in parallel', async ctx => {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not set');
      }

      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
      const finalStep = createStep({
        id: 'finalStep',
        inputSchema: z.object({
          'nested-workflow': z.object({ text: z.string() }),
          'nested-workflow-2': z.object({ text: z.string() }),
        }),
        outputSchema: z.object({
          result: z.string(),
        }),
        execute,
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({
          prompt1: z.string(),
          prompt2: z.string(),
        }),
        outputSchema: z.object({
          'nested-workflow': z.object({ text: z.string() }),
          'nested-workflow-2': z.object({ text: z.string() }),
        }),
      });

      const agent = new Agent({
        id: 'test-agent-1',
        name: 'test-agent-1',
        instructions: 'test agent instructions',
        model: openai('gpt-4'),
      });

      const agent2 = new Agent({
        id: 'test-agent-2',
        name: 'test-agent-2',
        instructions: 'test agent instructions',
        model: openai('gpt-4'),
      });

      const startStep = createStep({
        id: 'start',
        inputSchema: z.object({
          prompt1: z.string(),
          prompt2: z.string(),
        }),
        outputSchema: z.object({ prompt1: z.string(), prompt2: z.string() }),
        execute: async ({ inputData }) => {
          return {
            prompt1: inputData.prompt1,
            prompt2: inputData.prompt2,
          };
        },
      });

      const nestedWorkflow1 = createWorkflow({
        id: 'nested-workflow',
        inputSchema: z.object({ prompt1: z.string(), prompt2: z.string() }),
        outputSchema: z.object({ text: z.string() }),
      })
        .then(startStep)
        .map({
          prompt: {
            step: startStep,
            path: 'prompt1',
          },
        })
        .then(createStep(agent))
        .commit();

      const nestedWorkflow2 = createWorkflow({
        id: 'nested-workflow-2',
        inputSchema: z.object({ prompt1: z.string(), prompt2: z.string() }),
        outputSchema: z.object({ text: z.string() }),
      })
        .then(startStep)
        .map({
          prompt: {
            step: startStep,
            path: 'prompt2',
          },
        })
        .then(createStep(agent2))
        .commit();

      workflow.parallel([nestedWorkflow1, nestedWorkflow2]).then(finalStep).commit();

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
      const result = await run.start({
        inputData: { prompt1: 'Capital of France, just the name', prompt2: 'Capital of UK, just the name' },
      });

      expect(execute).toHaveBeenCalledTimes(1);
      expect(result.steps['finalStep']).toMatchObject({
        status: 'success',
        output: { result: 'success' },
      });

      expect(result.steps['nested-workflow']).toMatchObject({
        status: 'success',
        output: { text: 'Paris' },
      });

      expect(result.steps['nested-workflow-2']).toMatchObject({
        status: 'success',
        output: { text: 'London' },
      });

      srv.close();
    });
  });

  describe('Nested workflows', () => {
    it('should be able to nest workflows', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const start = vi.fn().mockImplementation(async ({ inputData }) => {
        // Get the current value (either from trigger or previous increment)
        const currentValue = inputData.startValue || 0;

        // Increment the value
        const newValue = currentValue + 1;

        return { newValue };
      });
      const startStep = createStep({
        id: 'start',
        inputSchema: z.object({ startValue: z.number() }),
        outputSchema: z.object({
          newValue: z.number(),
        }),
        execute: start,
      });

      const other = vi.fn().mockImplementation(async () => {
        return { other: 26 };
      });
      const otherStep = createStep({
        id: 'other',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({ other: z.number() }),
        execute: other,
      });

      const final = vi.fn().mockImplementation(async ({ getStepResult }) => {
        const startVal = getStepResult(startStep)?.newValue ?? 0;
        const otherVal = getStepResult(otherStep)?.other ?? 0;
        return { finalValue: startVal + otherVal };
      });
      const last = vi.fn().mockImplementation(async () => {
        return { success: true };
      });
      const finalStep = createStep({
        id: 'final',
        inputSchema: z.object({ newValue: z.number(), other: z.number() }),
        outputSchema: z.object({ success: z.boolean() }),
        execute: final,
      });

      const counterWorkflow = createWorkflow({
        id: 'counter-workflow',
        inputSchema: z.object({
          startValue: z.number(),
        }),
        outputSchema: z.object({ success: z.boolean() }),
        options: { validateInputs: false },
      });

      const wfA = createWorkflow({
        id: 'nested-workflow-a',
        inputSchema: counterWorkflow.inputSchema,
        outputSchema: z.object({ success: z.boolean() }),
        options: { validateInputs: false },
      })
        .then(startStep)
        .then(otherStep)
        .then(finalStep)
        .commit();
      const wfB = createWorkflow({
        id: 'nested-workflow-b',
        inputSchema: counterWorkflow.inputSchema,
        outputSchema: z.object({ success: z.boolean() }),
        options: { validateInputs: false },
      })
        .then(startStep)
        .then(finalStep)
        .commit();
      counterWorkflow
        .parallel([wfA, wfB])
        .then(
          createStep({
            id: 'last-step',
            inputSchema: z.object({
              'nested-workflow-a': z.object({ success: z.boolean() }),
              'nested-workflow-b': z.object({ success: z.boolean() }),
            }),
            outputSchema: z.object({ success: z.boolean() }),
            execute: last,
          }),
        )
        .commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-workflow': counterWorkflow,
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

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: { startValue: 0 } });

      srv.close();

      expect(start).toHaveBeenCalledTimes(2);
      expect(other).toHaveBeenCalledTimes(1);
      expect(final).toHaveBeenCalledTimes(2);
      expect(last).toHaveBeenCalledTimes(1);
      // @ts-ignore
      expect(result.steps['nested-workflow-a'].output).toMatchObject({
        finalValue: 26 + 1,
      });

      // @ts-ignore
      expect(result.steps['nested-workflow-b'].output).toMatchObject({
        finalValue: 1,
      });

      expect(result.steps['last-step']).toMatchObject({
        output: { success: true },
        status: 'success',
      });
    });

    it('should be able to nest workflows with conditions', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const start = vi.fn().mockImplementation(async ({ inputData }) => {
        // Get the current value (either from trigger or previous increment)
        const currentValue = inputData.startValue || 0;

        // Increment the value
        const newValue = currentValue + 1;

        return { newValue };
      });
      const startStep = createStep({
        id: 'start',
        inputSchema: z.object({ startValue: z.number() }),
        outputSchema: z.object({
          newValue: z.number(),
        }),
        execute: start,
      });

      const other = vi.fn().mockImplementation(async () => {
        return { other: 26 };
      });
      const otherStep = createStep({
        id: 'other',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({ other: z.number() }),
        execute: other,
      });

      const final = vi.fn().mockImplementation(async ({ getStepResult }) => {
        const startVal = getStepResult(startStep)?.newValue ?? 0;
        const otherVal = getStepResult(otherStep)?.other ?? 0;
        return { finalValue: startVal + otherVal };
      });
      const last = vi.fn().mockImplementation(async () => {
        return { success: true };
      });
      const finalStep = createStep({
        id: 'final',
        inputSchema: z.object({ newValue: z.number(), other: z.number() }),
        outputSchema: z.object({ finalValue: z.number() }),
        execute: final,
      });

      const counterWorkflow = createWorkflow({
        id: 'counter-workflow',
        inputSchema: z.object({
          startValue: z.number(),
        }),
        outputSchema: z.object({ success: z.boolean() }),
        options: { validateInputs: false },
      });

      const wfA = createWorkflow({
        id: 'nested-workflow-a',
        inputSchema: counterWorkflow.inputSchema,
        outputSchema: finalStep.outputSchema,
        options: { validateInputs: false },
      })
        .then(startStep)
        .then(otherStep)
        .then(finalStep)
        .commit();
      const wfB = createWorkflow({
        id: 'nested-workflow-b',
        inputSchema: counterWorkflow.inputSchema,
        outputSchema: z.object({ other: otherStep.outputSchema, final: finalStep.outputSchema }),
        options: { validateInputs: false },
      })
        .then(startStep)
        .branch([
          [async () => false, otherStep],
          // @ts-ignore
          [async () => true, finalStep],
        ])
        .map({
          finalValue: {
            step: finalStep,
            path: 'finalValue',
          },
        })
        .commit();
      counterWorkflow
        .parallel([wfA, wfB])
        .then(
          createStep({
            id: 'last-step',
            inputSchema: z.object({
              'nested-workflow-a': wfA.outputSchema,
              'nested-workflow-b': wfB.outputSchema,
            }),
            outputSchema: z.object({ success: z.boolean() }),
            execute: last,
          }),
        )
        .commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-workflow': counterWorkflow,
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

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: { startValue: 0 } });

      srv.close();

      expect(start).toHaveBeenCalledTimes(2);
      expect(other).toHaveBeenCalledTimes(1);
      expect(final).toHaveBeenCalledTimes(2);
      expect(last).toHaveBeenCalledTimes(1);
      // @ts-ignore
      expect(result.steps['nested-workflow-a'].output).toMatchObject({
        finalValue: 26 + 1,
      });

      // @ts-ignore
      expect(result.steps['nested-workflow-b'].output).toMatchObject({
        finalValue: 1,
      });

      expect(result.steps['last-step']).toMatchObject({
        output: { success: true },
        status: 'success',
      });
    });

    describe('new if else branching syntax with nested workflows', () => {
      it('should execute if-branch', async ctx => {
        const inngest = new Inngest({
          id: 'mastra',
          baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        });

        const { createWorkflow, createStep } = init(inngest);

        const start = vi.fn().mockImplementation(async ({ inputData }) => {
          // Get the current value (either from trigger or previous increment)
          const currentValue = inputData.startValue || 0;

          // Increment the value
          const newValue = currentValue + 1;

          return { newValue };
        });
        const startStep = createStep({
          id: 'start',
          inputSchema: z.object({ startValue: z.number() }),
          outputSchema: z.object({
            newValue: z.number(),
          }),
          execute: start,
        });

        const other = vi.fn().mockImplementation(async () => {
          return { other: 26 };
        });
        const otherStep = createStep({
          id: 'other',
          inputSchema: z.object({ newValue: z.number() }),
          outputSchema: z.object({ other: z.number() }),
          execute: other,
        });

        const final = vi.fn().mockImplementation(async ({ getStepResult }) => {
          const startVal = getStepResult(startStep)?.newValue ?? 0;
          const otherVal = getStepResult(otherStep)?.other ?? 0;
          return { finalValue: startVal + otherVal };
        });
        const first = vi.fn().mockImplementation(async () => {
          return { success: true };
        });
        const last = vi.fn().mockImplementation(async () => {
          return { success: true };
        });
        const finalStep = createStep({
          id: 'final',
          inputSchema: z.object({ newValue: z.number(), other: z.number() }),
          outputSchema: z.object({ finalValue: z.number() }),
          execute: final,
        });

        const counterWorkflow = createWorkflow({
          id: 'counter-workflow',
          inputSchema: z.object({
            startValue: z.number(),
          }),
          outputSchema: z.object({ success: z.boolean() }),
          options: { validateInputs: false },
        });

        const wfA = createWorkflow({
          id: 'nested-workflow-a',
          inputSchema: counterWorkflow.inputSchema,
          outputSchema: finalStep.outputSchema,
          options: { validateInputs: false },
        })
          .then(startStep)
          .then(otherStep)
          .then(finalStep)
          .commit();
        const wfB = createWorkflow({
          id: 'nested-workflow-b',
          inputSchema: counterWorkflow.inputSchema,
          outputSchema: finalStep.outputSchema,
          options: { validateInputs: false },
        })
          .then(startStep)
          .then(finalStep)
          .commit();
        counterWorkflow
          .then(
            createStep({
              id: 'first-step',
              inputSchema: z.object({ startValue: z.number() }),
              outputSchema: wfA.inputSchema,
              execute: first,
            }),
          )
          .branch([
            [async () => true, wfA],
            [async () => false, wfB],
          ])
          .then(
            createStep({
              id: 'last-step',
              inputSchema: z.object({
                'nested-workflow-a': wfA.outputSchema,
                'nested-workflow-b': wfB.outputSchema,
              }),
              outputSchema: z.object({ success: z.boolean() }),
              execute: last,
            }),
          )
          .commit();

        const mastra = new Mastra({
          storage: new DefaultStorage({
            id: 'test-storage',
            url: ':memory:',
          }),
          workflows: {
            'test-workflow': counterWorkflow,
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
        app.use('*', async (ctx, next) => {
          await next();
        });

        const srv = (globServer = serve({
          fetch: app.fetch,
          port: (ctx as any).handlerPort,
        }));
        await resetInngest();

        const run = await counterWorkflow.createRun();
        const result = await run.start({ inputData: { startValue: 0 } });

        srv.close();

        expect(start).toHaveBeenCalledTimes(1);
        expect(other).toHaveBeenCalledTimes(1);
        expect(final).toHaveBeenCalledTimes(1);
        expect(first).toHaveBeenCalledTimes(1);
        expect(last).toHaveBeenCalledTimes(1);
        // @ts-ignore
        expect(result.steps['nested-workflow-a'].output).toMatchObject({
          finalValue: 26 + 1,
        });

        expect(result.steps['first-step']).toMatchObject({
          output: { success: true },
          status: 'success',
        });

        expect(result.steps['last-step']).toMatchObject({
          output: { success: true },
          status: 'success',
        });
      });

      it('should execute else-branch', async ctx => {
        const inngest = new Inngest({
          id: 'mastra',
          baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        });

        const { createWorkflow, createStep } = init(inngest);

        const start = vi.fn().mockImplementation(async ({ inputData }) => {
          // Get the current value (either from trigger or previous increment)
          const currentValue = inputData.startValue || 0;

          // Increment the value
          const newValue = currentValue + 1;

          return { newValue };
        });
        const startStep = createStep({
          id: 'start',
          inputSchema: z.object({ startValue: z.number() }),
          outputSchema: z.object({
            newValue: z.number(),
          }),
          execute: start,
        });

        const other = vi.fn().mockImplementation(async () => {
          return { other: 26 };
        });
        const otherStep = createStep({
          id: 'other',
          inputSchema: z.object({ newValue: z.number() }),
          outputSchema: z.object({ other: z.number() }),
          execute: other,
        });

        const final = vi.fn().mockImplementation(async ({ getStepResult }) => {
          const startVal = getStepResult(startStep)?.newValue ?? 0;
          const otherVal = getStepResult(otherStep)?.other ?? 0;
          return { finalValue: startVal + otherVal };
        });
        const first = vi.fn().mockImplementation(async () => {
          return { success: true };
        });
        const last = vi.fn().mockImplementation(async () => {
          return { success: true };
        });
        const finalStep = createStep({
          id: 'final',
          inputSchema: z.object({ newValue: z.number(), other: z.number() }),
          outputSchema: z.object({ finalValue: z.number() }),
          execute: final,
        });

        const counterWorkflow = createWorkflow({
          id: 'counter-workflow',
          inputSchema: z.object({
            startValue: z.number(),
          }),
          outputSchema: z.object({ success: z.boolean() }),
          options: { validateInputs: false },
        });

        const wfA = createWorkflow({
          id: 'nested-workflow-a',
          inputSchema: counterWorkflow.inputSchema,
          outputSchema: finalStep.outputSchema,
          options: { validateInputs: false },
        })
          .then(startStep)
          .then(otherStep)
          .then(finalStep)
          .commit();
        const wfB = createWorkflow({
          id: 'nested-workflow-b',
          inputSchema: counterWorkflow.inputSchema,
          outputSchema: finalStep.outputSchema,
          options: { validateInputs: false },
        })
          .then(startStep)
          .then(finalStep)
          .commit();
        counterWorkflow
          .then(
            createStep({
              id: 'first-step',
              inputSchema: z.object({ startValue: z.number() }),
              outputSchema: wfA.inputSchema,
              execute: first,
            }),
          )
          .branch([
            [async () => false, wfA],
            [async () => true, wfB],
          ])
          .then(
            createStep({
              id: 'last-step',
              inputSchema: z.object({
                'nested-workflow-a': wfA.outputSchema,
                'nested-workflow-b': wfB.outputSchema,
              }),
              outputSchema: z.object({ success: z.boolean() }),
              execute: last,
            }),
          )
          .commit();

        const mastra = new Mastra({
          storage: new DefaultStorage({
            id: 'test-storage',
            url: ':memory:',
          }),
          workflows: {
            'test-workflow': counterWorkflow,
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
        app.use('*', async (ctx, next) => {
          await next();
        });

        const srv = (globServer = serve({
          fetch: app.fetch,
          port: (ctx as any).handlerPort,
        }));
        await resetInngest();

        const run = await counterWorkflow.createRun();
        const result = await run.start({ inputData: { startValue: 0 } });

        srv.close();

        expect(start).toHaveBeenCalledTimes(1);
        expect(other).toHaveBeenCalledTimes(0);
        expect(final).toHaveBeenCalledTimes(1);
        expect(first).toHaveBeenCalledTimes(1);
        expect(last).toHaveBeenCalledTimes(1);

        // @ts-ignore
        expect(result.steps['nested-workflow-b'].output).toMatchObject({
          finalValue: 1,
        });

        expect(result.steps['first-step']).toMatchObject({
          output: { success: true },
          status: 'success',
        });

        expect(result.steps['last-step']).toMatchObject({
          output: { success: true },
          status: 'success',
        });
      });

      it('should execute nested else and if-branch', async ctx => {
        const inngest = new Inngest({
          id: 'mastra',
          baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        });

        const { createWorkflow, createStep } = init(inngest);

        const start = vi.fn().mockImplementation(async ({ inputData }) => {
          // Get the current value (either from trigger or previous increment)
          const currentValue = inputData.startValue || 0;

          // Increment the value
          const newValue = currentValue + 1;

          return { newValue };
        });
        const startStep = createStep({
          id: 'start',
          inputSchema: z.object({ startValue: z.number() }),
          outputSchema: z.object({
            newValue: z.number(),
          }),
          execute: start,
        });

        const other = vi.fn().mockImplementation(async () => {
          return { other: 26 };
        });
        const otherStep = createStep({
          id: 'other',
          inputSchema: z.object({ newValue: z.number() }),
          outputSchema: z.object({ other: z.number() }),
          execute: other,
        });

        const final = vi.fn().mockImplementation(async ({ getStepResult }) => {
          const startVal = getStepResult(startStep)?.newValue ?? 0;
          const otherVal = getStepResult(otherStep)?.other ?? 0;
          return { finalValue: startVal + otherVal };
        });
        const first = vi.fn().mockImplementation(async () => {
          return { success: true };
        });
        const last = vi.fn().mockImplementation(async () => {
          return { success: true };
        });
        const finalStep = createStep({
          id: 'final',
          inputSchema: z.object({ newValue: z.number(), other: z.number() }),
          outputSchema: z.object({ finalValue: z.number() }),
          execute: final,
        });

        const counterWorkflow = createWorkflow({
          id: 'counter-workflow',
          inputSchema: z.object({
            startValue: z.number(),
          }),
          outputSchema: z.object({ success: z.boolean() }),
          options: { validateInputs: false },
        });

        const wfA = createWorkflow({
          id: 'nested-workflow-a',
          inputSchema: counterWorkflow.inputSchema,
          outputSchema: finalStep.outputSchema,
          options: { validateInputs: false },
        })
          .then(startStep)
          .then(otherStep)
          .then(finalStep)
          .commit();
        const wfB = createWorkflow({
          id: 'nested-workflow-b',
          inputSchema: counterWorkflow.inputSchema,
          outputSchema: finalStep.outputSchema,
          options: { validateInputs: false },
        })
          .then(startStep)
          .branch([
            [
              async () => true,
              createWorkflow({
                id: 'nested-workflow-c',
                inputSchema: startStep.outputSchema,
                outputSchema: otherStep.outputSchema,
              })
                .then(otherStep)
                .commit(),
            ],
            [
              async () => false,
              createWorkflow({
                id: 'nested-workflow-d',
                inputSchema: startStep.outputSchema,
                outputSchema: otherStep.outputSchema,
              })
                .then(otherStep)
                .commit(),
            ],
          ])
          // TODO: maybe make this a little nicer to do with .map()?
          .then(
            createStep({
              id: 'map-results',
              inputSchema: z.object({
                'nested-workflow-c': otherStep.outputSchema,
                'nested-workflow-d': otherStep.outputSchema,
              }),
              outputSchema: otherStep.outputSchema,
              execute: async ({ inputData }) => {
                return { other: inputData['nested-workflow-c']?.other ?? inputData['nested-workflow-d']?.other };
              },
            }),
          )
          .then(finalStep)
          .commit();

        counterWorkflow
          .then(
            createStep({
              id: 'first-step',
              inputSchema: z.object({ startValue: z.number() }),
              outputSchema: wfA.inputSchema,
              execute: first,
            }),
          )
          .branch([
            [async () => false, wfA],
            [async () => true, wfB],
          ])
          .then(
            createStep({
              id: 'last-step',
              inputSchema: z.object({
                'nested-workflow-a': wfA.outputSchema,
                'nested-workflow-b': wfB.outputSchema,
              }),
              outputSchema: z.object({ success: z.boolean() }),
              execute: last,
            }),
          )
          .commit();

        const mastra = new Mastra({
          storage: new DefaultStorage({
            id: 'test-storage',
            url: ':memory:',
          }),
          workflows: {
            'test-workflow': counterWorkflow,
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
        app.use('*', async (ctx, next) => {
          await next();
        });

        const srv = (globServer = serve({
          fetch: app.fetch,
          port: (ctx as any).handlerPort,
        }));
        await resetInngest();

        const run = await counterWorkflow.createRun();
        const result = await run.start({ inputData: { startValue: 1 } });

        srv.close();

        // expect(start).toHaveBeenCalledTimes(1);
        // expect(other).toHaveBeenCalledTimes(1);
        // expect(final).toHaveBeenCalledTimes(1);
        // expect(first).toHaveBeenCalledTimes(1);
        // expect(last).toHaveBeenCalledTimes(1);

        // @ts-ignore
        expect(result.steps['nested-workflow-b'].output).toMatchObject({
          finalValue: 1,
        });

        expect(result.steps['first-step']).toMatchObject({
          output: { success: true },
          status: 'success',
        });

        expect(result.steps['last-step']).toMatchObject({
          output: { success: true },
          status: 'success',
        });
      });
    });

    describe('suspending and resuming nested workflows', () => {
      it('should be able to suspend nested workflow step', async ctx => {
        const inngest = new Inngest({
          id: 'mastra',
          baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        });

        const { createWorkflow, createStep } = init(inngest);

        const start = vi.fn().mockImplementation(async ({ inputData }) => {
          // Get the current value (either from trigger or previous increment)
          const currentValue = inputData.startValue || 0;

          // Increment the value
          const newValue = currentValue + 1;

          return { newValue };
        });
        const startStep = createStep({
          id: 'start',
          inputSchema: z.object({ startValue: z.number() }),
          outputSchema: z.object({
            newValue: z.number(),
          }),
          execute: start,
        });

        const other = vi.fn().mockImplementation(async ({ suspend, resumeData }) => {
          if (!resumeData) {
            await suspend();
          }
          return { other: 26 };
        });
        const otherStep = createStep({
          id: 'other',
          inputSchema: z.object({ newValue: z.number() }),
          outputSchema: z.object({ other: z.number() }),
          execute: other,
        });

        const final = vi.fn().mockImplementation(async ({ getStepResult }) => {
          const startVal = getStepResult(startStep)?.newValue ?? 0;
          const otherVal = getStepResult(otherStep)?.other ?? 0;
          return { finalValue: startVal + otherVal };
        });
        const last = vi.fn().mockImplementation(async ({}) => {
          return { success: true };
        });
        const begin = vi.fn().mockImplementation(async ({ inputData }) => {
          return inputData;
        });
        const finalStep = createStep({
          id: 'final',
          inputSchema: z.object({ newValue: z.number(), other: z.number() }),
          outputSchema: z.object({
            finalValue: z.number(),
          }),
          execute: final,
        });

        const counterWorkflow = createWorkflow({
          id: 'counter-workflow',
          inputSchema: z.object({
            startValue: z.number(),
          }),
          outputSchema: z.object({
            finalValue: z.number(),
          }),
          options: { validateInputs: false },
        });

        const wfA = createWorkflow({
          id: 'nested-workflow-a',
          inputSchema: counterWorkflow.inputSchema,
          outputSchema: finalStep.outputSchema,
          options: { validateInputs: false },
        })
          .then(startStep)
          .then(otherStep)
          .then(finalStep)
          .commit();

        counterWorkflow
          .then(
            createStep({
              id: 'begin-step',
              inputSchema: counterWorkflow.inputSchema,
              outputSchema: counterWorkflow.inputSchema,
              execute: begin,
            }),
          )
          .then(wfA)
          .then(
            createStep({
              id: 'last-step',
              inputSchema: wfA.outputSchema,
              outputSchema: z.object({ success: z.boolean() }),
              execute: last,
            }),
          )
          .commit();

        const mastra = new Mastra({
          storage: new DefaultStorage({
            id: 'test-storage',
            url: ':memory:',
          }),
          workflows: {
            'test-workflow': counterWorkflow,
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

        const run = await counterWorkflow.createRun();
        const result = await run.start({ inputData: { startValue: 0 } });

        expect(begin).toHaveBeenCalledTimes(1);
        expect(start).toHaveBeenCalledTimes(1);
        expect(other).toHaveBeenCalledTimes(1);
        expect(final).toHaveBeenCalledTimes(0);
        expect(last).toHaveBeenCalledTimes(0);
        expect(result.steps['nested-workflow-a']).toMatchObject({
          status: 'suspended',
        });

        // @ts-ignore
        expect(result.steps['last-step']).toMatchObject(undefined);

        const resumedResults = await run.resume({ step: [wfA, otherStep], resumeData: { newValue: 0 } });

        // @ts-ignore
        expect(resumedResults.steps['nested-workflow-a'].output).toMatchObject({
          finalValue: 26 + 1,
        });

        expect(start).toHaveBeenCalledTimes(1);
        expect(other).toHaveBeenCalledTimes(2);
        expect(final).toHaveBeenCalledTimes(1);
        expect(last).toHaveBeenCalledTimes(1);

        srv.close();
      });
    });

    describe('Workflow results', () => {
      it('should be able to spec out workflow result via variables', async ctx => {
        const inngest = new Inngest({
          id: 'mastra',
          baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        });

        const { createWorkflow, createStep } = init(inngest);

        const start = vi.fn().mockImplementation(async ({ inputData }) => {
          // Get the current value (either from trigger or previous increment)
          const currentValue = inputData.startValue || 0;

          // Increment the value
          const newValue = currentValue + 1;

          return { newValue };
        });
        const startStep = createStep({
          id: 'start',
          inputSchema: z.object({ startValue: z.number() }),
          outputSchema: z.object({
            newValue: z.number(),
          }),
          execute: start,
        });

        const other = vi.fn().mockImplementation(async () => {
          return { other: 26 };
        });
        const otherStep = createStep({
          id: 'other',
          inputSchema: z.object({ newValue: z.number() }),
          outputSchema: z.object({ other: z.number() }),
          execute: other,
        });

        const final = vi.fn().mockImplementation(async ({ getStepResult }) => {
          const startVal = getStepResult(startStep)?.newValue ?? 0;
          const otherVal = getStepResult(otherStep)?.other ?? 0;
          return { finalValue: startVal + otherVal };
        });
        const last = vi.fn().mockImplementation(async () => {
          return { success: true };
        });
        const finalStep = createStep({
          id: 'final',
          inputSchema: z.object({ newValue: z.number(), other: z.number() }),
          outputSchema: z.object({
            finalValue: z.number(),
          }),
          execute: final,
        });

        const wfA = createWorkflow({
          steps: [startStep, otherStep, finalStep],
          id: 'nested-workflow-a',
          inputSchema: z.object({
            startValue: z.number(),
          }),
          outputSchema: z.object({
            finalValue: z.number(),
          }),
          options: { validateInputs: false },
        })
          .then(startStep)
          .then(otherStep)
          .then(finalStep)
          .commit();

        const counterWorkflow = createWorkflow({
          id: 'counter-workflow',
          inputSchema: z.object({
            startValue: z.number(),
          }),
          outputSchema: z.object({
            finalValue: z.number(),
          }),
          options: { validateInputs: false },
        });

        counterWorkflow
          .then(wfA)
          .then(
            createStep({
              id: 'last-step',
              inputSchema: wfA.outputSchema,
              outputSchema: z.object({ success: z.boolean() }),
              execute: last,
            }),
          )
          .commit();

        const mastra = new Mastra({
          storage: new DefaultStorage({
            id: 'test-storage',
            url: ':memory:',
          }),
          workflows: {
            'test-workflow': counterWorkflow,
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
        app.use('*', async (ctx, next) => {
          await next();
        });

        const srv = (globServer = serve({
          fetch: app.fetch,
          port: (ctx as any).handlerPort,
        }));
        await resetInngest();

        const run = await counterWorkflow.createRun();
        const result = await run.start({ inputData: { startValue: 0 } });
        const results = result.steps;

        srv.close();

        expect(start).toHaveBeenCalledTimes(1);
        expect(other).toHaveBeenCalledTimes(1);
        expect(final).toHaveBeenCalledTimes(1);
        expect(last).toHaveBeenCalledTimes(1);

        // @ts-ignore
        expect(results['nested-workflow-a']).toMatchObject({
          status: 'success',
          output: {
            finalValue: 26 + 1,
          },
        });

        expect(result.steps['last-step']).toMatchObject({
          status: 'success',
          output: { success: true },
        });
      });
    });

    it('should be able to suspend nested workflow step in a nested workflow step', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const start = vi.fn().mockImplementation(async ({ inputData }) => {
        // Get the current value (either from trigger or previous increment)
        const currentValue = inputData.startValue || 0;

        // Increment the value
        const newValue = currentValue + 1;

        return { newValue };
      });
      const startStep = createStep({
        id: 'start',
        inputSchema: z.object({ startValue: z.number() }),
        outputSchema: z.object({
          newValue: z.number(),
        }),
        execute: start,
      });

      const other = vi.fn().mockImplementation(async ({ suspend, resumeData }) => {
        if (!resumeData) {
          await suspend();
        }
        return { other: 26 };
      });
      const otherStep = createStep({
        id: 'other',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({ other: z.number() }),
        execute: other,
      });

      const final = vi.fn().mockImplementation(async ({ getStepResult }) => {
        const startVal = getStepResult(startStep)?.newValue ?? 0;
        const otherVal = getStepResult(otherStep)?.other ?? 0;
        return { finalValue: startVal + otherVal };
      });
      const last = vi.fn().mockImplementation(async ({}) => {
        return { success: true };
      });
      const begin = vi.fn().mockImplementation(async ({ inputData }) => {
        return inputData;
      });
      const finalStep = createStep({
        id: 'final',
        inputSchema: z.object({ newValue: z.number(), other: z.number() }),
        outputSchema: z.object({
          finalValue: z.number(),
        }),
        execute: final,
      });

      const counterInputSchema = z.object({
        startValue: z.number(),
      });
      const counterOutputSchema = z.object({
        finalValue: z.number(),
      });

      const passthroughStep = createStep({
        id: 'passthrough',
        inputSchema: counterInputSchema,
        outputSchema: counterInputSchema,
        execute: vi.fn().mockImplementation(async ({ inputData }) => {
          return inputData;
        }),
      });

      const wfA = createWorkflow({
        id: 'nested-workflow-a',
        inputSchema: counterInputSchema,
        outputSchema: finalStep.outputSchema,
        options: { validateInputs: false },
      })
        .then(startStep)
        .then(otherStep)
        .then(finalStep)
        .commit();

      const wfB = createWorkflow({
        id: 'nested-workflow-b',
        inputSchema: counterInputSchema,
        outputSchema: finalStep.outputSchema,
        options: { validateInputs: false },
      })
        .then(passthroughStep)
        .then(wfA)
        .commit();

      const wfC = createWorkflow({
        id: 'nested-workflow-c',
        inputSchema: counterInputSchema,
        outputSchema: finalStep.outputSchema,
        options: { validateInputs: false },
      })
        .then(passthroughStep)
        .then(wfB)
        .commit();

      const counterWorkflow = createWorkflow({
        id: 'counter-workflow',
        inputSchema: counterInputSchema,
        outputSchema: counterOutputSchema,
        steps: [wfC, passthroughStep],
        options: { validateInputs: false },
      });

      counterWorkflow
        .then(
          createStep({
            id: 'begin-step',
            inputSchema: counterWorkflow.inputSchema,
            outputSchema: counterWorkflow.inputSchema,
            execute: begin,
          }),
        )
        .then(wfC)
        .then(
          createStep({
            id: 'last-step',
            inputSchema: wfA.outputSchema,
            outputSchema: z.object({ success: z.boolean() }),
            execute: last,
          }),
        )
        .commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-workflow': counterWorkflow,
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

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: { startValue: 0 } });

      expect(passthroughStep.execute).toHaveBeenCalledTimes(2);
      expect(result.steps['nested-workflow-c']).toMatchObject({
        status: 'suspended',
        suspendPayload: {
          __workflow_meta: {
            path: ['nested-workflow-b', 'nested-workflow-a', 'other'],
          },
        },
      });

      // @ts-ignore
      expect(result.steps['last-step']).toMatchObject(undefined);

      if (result.status !== 'suspended') {
        expect.fail('Workflow should be suspended');
      }
      expect(result.suspended[0]).toMatchObject([
        'nested-workflow-c',
        'nested-workflow-b',
        'nested-workflow-a',
        'other',
      ]);
      const resumedResults = await run.resume({ step: result.suspended[0], resumeData: { newValue: 0 } });

      srv.close();

      // @ts-ignore
      expect(resumedResults.steps['nested-workflow-c'].output).toMatchObject({
        finalValue: 26 + 1,
      });

      expect(start).toHaveBeenCalledTimes(1);
      expect(other).toHaveBeenCalledTimes(2);
      expect(final).toHaveBeenCalledTimes(1);
      expect(last).toHaveBeenCalledTimes(1);
      expect(passthroughStep.execute).toHaveBeenCalledTimes(2);
    });

    it('should be able clone workflows as steps', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep, cloneStep, cloneWorkflow } = init(inngest);

      const start = vi.fn().mockImplementation(async ({ inputData }) => {
        // Get the current value (either from trigger or previous increment)
        const currentValue = inputData.startValue || 0;

        // Increment the value
        const newValue = currentValue + 1;

        return { newValue };
      });
      const startStep = createStep({
        id: 'start',
        inputSchema: z.object({ startValue: z.number() }),
        outputSchema: z.object({
          newValue: z.number(),
        }),
        execute: start,
      });

      const other = vi.fn().mockImplementation(async () => {
        return { other: 26 };
      });
      const otherStep = createStep({
        id: 'other',
        inputSchema: z.object({ newValue: z.number() }),
        outputSchema: z.object({ other: z.number() }),
        execute: other,
      });

      const final = vi.fn().mockImplementation(async ({ getStepResult }) => {
        const startVal = getStepResult(startStep)?.newValue ?? 0;
        const otherVal = getStepResult(cloneStep(otherStep, { id: 'other-clone' }))?.other ?? 0;
        return { finalValue: startVal + otherVal };
      });
      const last = vi.fn().mockImplementation(async ({ inputData }) => {
        console.log('inputData', inputData);
        return { success: true };
      });
      const finalStep = createStep({
        id: 'final',
        inputSchema: z.object({ newValue: z.number(), other: z.number() }),
        outputSchema: z.object({ success: z.boolean() }),
        execute: final,
      });

      const counterWorkflow = createWorkflow({
        id: 'counter-workflow',
        inputSchema: z.object({
          startValue: z.number(),
        }),
        outputSchema: z.object({ success: z.boolean() }),
        options: { validateInputs: false },
      });

      const wfA = createWorkflow({
        id: 'nested-workflow-a',
        inputSchema: counterWorkflow.inputSchema,
        outputSchema: z.object({ success: z.boolean() }),
        options: { validateInputs: false },
      })
        .then(startStep)
        .then(cloneStep(otherStep, { id: 'other-clone' }))
        .then(finalStep)
        .commit();
      const wfB = createWorkflow({
        id: 'nested-workflow-b',
        inputSchema: counterWorkflow.inputSchema,
        outputSchema: z.object({ success: z.boolean() }),
        options: { validateInputs: false },
      })
        .then(startStep)
        .then(cloneStep(finalStep, { id: 'final-clone' }))
        .commit();

      const wfAClone = cloneWorkflow(wfA, { id: 'nested-workflow-a-clone' });

      counterWorkflow
        .parallel([wfAClone, wfB])
        .then(
          createStep({
            id: 'last-step',
            inputSchema: z.object({
              'nested-workflow-b': z.object({ success: z.boolean() }),
              'nested-workflow-a-clone': z.object({ success: z.boolean() }),
            }),
            outputSchema: z.object({ success: z.boolean() }),
            execute: last,
          }),
        )
        .commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-workflow': counterWorkflow,
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

      const run = await counterWorkflow.createRun();
      const result = await run.start({ inputData: { startValue: 0 } });

      srv.close();

      expect(start).toHaveBeenCalledTimes(2);
      expect(other).toHaveBeenCalledTimes(1);
      expect(final).toHaveBeenCalledTimes(2);
      expect(last).toHaveBeenCalledTimes(1);
      // @ts-ignore
      expect(result.steps['nested-workflow-a-clone'].output).toMatchObject({
        finalValue: 26 + 1,
      });

      // @ts-ignore
      expect(result.steps['nested-workflow-b'].output).toMatchObject({
        finalValue: 1,
      });

      expect(result.steps['last-step']).toMatchObject({
        output: { success: true },
        status: 'success',
      });
    });
  });

  // TODO: can we support this on inngest?
  describe.skip('Dependency Injection', () => {
    it('should inject requestContext dependencies into steps during run', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const requestContext = new RequestContext();
      const testValue = 'test-dependency';
      requestContext.set('testKey', testValue);

      const step = createStep({
        id: 'step1',
        execute: async ({ requestContext }) => {
          const value = requestContext.get('testKey');
          return { injectedValue: value };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const workflow = createWorkflow({ id: 'test-workflow', inputSchema: z.object({}), outputSchema: z.object({}) });
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
      const result = await run.start({ requestContext });

      srv.close();

      // @ts-ignore
      expect(result.steps.step1.output.injectedValue).toBe(testValue);
    });

    it.skip('should inject requestContext dependencies into steps during resume', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const initialStorage = new DefaultStorage({
        id: 'test-storage',
        url: 'file::memory:',
      });

      const requestContext = new RequestContext();
      const testValue = 'test-dependency';
      requestContext.set('testKey', testValue);

      const mastra = new Mastra({
        logger: false,
        storage: initialStorage,
      });

      const execute = vi.fn(async ({ requestContext, suspend, resumeData }) => {
        if (!resumeData?.human) {
          await suspend();
        }

        const value = requestContext.get('testKey');
        return { injectedValue: value };
      });

      const step = createStep({
        id: 'step1',
        execute,
        inputSchema: z.object({ human: z.boolean() }),
        outputSchema: z.object({}),
      });
      const workflow = createWorkflow({
        id: 'test-workflow',
        mastra,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      workflow.then(step).commit();

      const run = await workflow.createRun();
      await run.start({ requestContext });

      const resumerequestContext = new RequestContext();
      resumerequestContext.set('testKey', testValue + '2');

      const result = await run.resume({
        step: step,
        resumeData: {
          human: true,
        },
        requestContext: resumerequestContext,
      });

      // @ts-ignore
      expect(result?.steps.step1.output.injectedValue).toBe(testValue + '2');
    });

    it('should have access to requestContext from before suspension during workflow resume', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const testValue = 'test-dependency';
      const resumeStep = createStep({
        id: 'resume',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
        resumeSchema: z.object({ value: z.number() }),
        suspendSchema: z.object({ message: z.string() }),
        execute: async ({ inputData, resumeData, suspend }) => {
          const finalValue = (resumeData?.value ?? 0) + inputData.value;

          if (!resumeData?.value || finalValue < 10) {
            return await suspend({
              message: `Please provide additional information. now value is ${inputData.value}`,
            });
          }

          return { value: finalValue };
        },
      });

      const incrementStep = createStep({
        id: 'increment',
        inputSchema: z.object({
          value: z.number(),
        }),
        outputSchema: z.object({
          value: z.number(),
        }),
        execute: async ({ inputData, requestContext }) => {
          requestContext.set('testKey', testValue);
          return {
            value: inputData.value + 1,
          };
        },
      });

      const incrementWorkflow = createWorkflow({
        id: 'increment-workflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
      })
        .then(incrementStep)
        .then(resumeStep)
        .then(
          createStep({
            id: 'final',
            inputSchema: z.object({ value: z.number() }),
            outputSchema: z.object({ value: z.number() }),
            execute: async ({ inputData, requestContext }) => {
              const testKey = requestContext.get('testKey');
              expect(testKey).toBe(testValue);
              return { value: inputData.value };
            },
          }),
        )
        .commit();

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { incrementWorkflow },
      });

      const run = await incrementWorkflow.createRun();
      const result = await run.start({ inputData: { value: 0 } });
      expect(result.status).toBe('suspended');

      const resumeResult = await run.resume({
        resumeData: { value: 21 },
        step: ['resume'],
      });

      expect(resumeResult.status).toBe('success');
    });

    it('should not show removed requestContext values in subsequent steps', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);
      const testValue = 'test-dependency';
      const resumeStep = createStep({
        id: 'resume',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
        resumeSchema: z.object({ value: z.number() }),
        suspendSchema: z.object({ message: z.string() }),
        execute: async ({ inputData, resumeData, suspend, requestContext }) => {
          const finalValue = (resumeData?.value ?? 0) + inputData.value;

          if (!resumeData?.value || finalValue < 10) {
            return await suspend({
              message: `Please provide additional information. now value is ${inputData.value}`,
            });
          }

          const testKey = requestContext.get('testKey');
          expect(testKey).toBe(testValue);

          requestContext.delete('testKey');

          return { value: finalValue };
        },
      });

      const incrementStep = createStep({
        id: 'increment',
        inputSchema: z.object({
          value: z.number(),
        }),
        outputSchema: z.object({
          value: z.number(),
        }),
        execute: async ({ inputData, requestContext }) => {
          requestContext.set('testKey', testValue);
          return {
            value: inputData.value + 1,
          };
        },
      });

      const incrementWorkflow = createWorkflow({
        id: 'increment-workflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
      })
        .then(incrementStep)
        .then(resumeStep)
        .then(
          createStep({
            id: 'final',
            inputSchema: z.object({ value: z.number() }),
            outputSchema: z.object({ value: z.number() }),
            execute: async ({ inputData, requestContext }) => {
              const testKey = requestContext.get('testKey');
              expect(testKey).toBeUndefined();
              return { value: inputData.value };
            },
          }),
        )
        .commit();

      new Mastra({
        logger: false,
        storage: testStorage,
        workflows: { incrementWorkflow },
      });

      const run = await incrementWorkflow.createRun();
      const result = await run.start({ inputData: { value: 0 } });
      expect(result.status).toBe('suspended');

      const resumeResult = await run.resume({
        resumeData: { value: 21 },
        step: ['resume'],
      });

      expect(resumeResult.status).toBe('success');
    });
  });

  describe('Access to inngest step primitives', () => {
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

      // @ts-ignore
      expect(result?.steps.step1.output.hasEngine).toBe(true);
    });
  });

  describe('Streaming', () => {
    it('should generate a stream', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1Action = vi.fn<any>().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'success2' });

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

    it('should handle basic sleep waiting flow', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1Action = vi.fn<any>().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'success2' });

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

      expect(watchData.length).toBe(11);
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
            startedAt: expect.any(Number),
            status: 'running',
            payload: {},
          },
          type: 'step-start',
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
            id: expect.any(String),
            startedAt: expect.any(Number),
            status: 'waiting',
            payload: {
              result: 'success1',
            },
          },
          type: 'step-waiting',
        },
        {
          payload: {
            id: expect.any(String),
            endedAt: expect.any(Number),
            status: 'success',
            output: {
              result: 'success1',
            },
          },
          type: 'step-result',
        },
        {
          type: 'step-finish',
          payload: {
            id: expect.any(String),
            metadata: {},
          },
        },
        {
          payload: {
            id: 'step2',
            payload: {
              result: 'success1',
            },
            startedAt: expect.any(Number),
            status: 'running',
          },
          type: 'step-start',
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

    it('should handle basic sleep waiting flow with fn parameter', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1Action = vi.fn<any>().mockResolvedValue({ value: 1000 });
      const step2Action = vi.fn<any>().mockResolvedValue({ value: 2000 });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.number() }),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [step1, step2],
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

      expect(watchData.length).toBe(11);
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
            startedAt: expect.any(Number),
            status: 'running',
            payload: {},
          },
          type: 'step-start',
        },
        {
          payload: {
            id: 'step1',
            output: {
              value: 1000,
            },
            endedAt: expect.any(Number),
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
            id: expect.any(String),
            startedAt: expect.any(Number),
            status: 'waiting',
            payload: {
              value: 1000,
            },
          },
          type: 'step-waiting',
        },
        {
          payload: {
            id: expect.any(String),
            endedAt: expect.any(Number),
            status: 'success',
            output: {
              value: 1000,
            },
          },
          type: 'step-result',
        },
        {
          type: 'step-finish',
          payload: {
            id: expect.any(String),
            metadata: {},
          },
        },
        {
          payload: {
            id: 'step2',
            payload: {
              value: 1000,
            },
            startedAt: expect.any(Number),
            status: 'running',
          },
          type: 'step-start',
        },
        {
          payload: {
            id: 'step2',
            output: {
              value: 2000,
            },
            endedAt: expect.any(Number),
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
        output: { value: 1000 },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(executionResult.steps.step2).toMatchObject({
        status: 'success',
        output: { value: 2000 },
        payload: {
          value: 1000,
        },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
    });

    it('should handle basic suspend and resume flow', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          console.log('suspend');
          await suspend();
          return undefined;
        })
        .mockImplementationOnce(() => ({ modelOutput: 'test output' }));
      const evaluateToneAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.8 },
        completenessScore: { score: 0.7 },
      });
      const improveResponseAction = vi.fn().mockResolvedValue({ improvedOutput: 'improved output' });
      const evaluateImprovedAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.9 },
        completenessScore: { score: 0.8 },
      });

      const getUserInput = createStep({
        id: 'getUserInput',
        execute: getUserInputAction,
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ userInput: z.string() }),
      });
      const promptAgent = createStep({
        id: 'promptAgent',
        execute: promptAgentAction,
        inputSchema: z.object({ userInput: z.string() }),
        outputSchema: z.object({ modelOutput: z.string() }),
      });
      const evaluateTone = createStep({
        id: 'evaluateToneConsistency',
        execute: evaluateToneAction,
        inputSchema: z.object({ modelOutput: z.string() }),
        outputSchema: z.object({
          toneScore: z.any(),
          completenessScore: z.any(),
        }),
      });
      const improveResponse = createStep({
        id: 'improveResponse',
        execute: improveResponseAction,
        inputSchema: z.object({ toneScore: z.any(), completenessScore: z.any() }),
        outputSchema: z.object({ improvedOutput: z.string() }),
      });
      const evaluateImproved = createStep({
        id: 'evaluateImprovedResponse',
        execute: evaluateImprovedAction,
        inputSchema: z.object({ improvedOutput: z.string() }),
        outputSchema: z.object({
          toneScore: z.any(),
          completenessScore: z.any(),
        }),
      });

      const promptEvalWorkflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({}),
        steps: [getUserInput, promptAgent, evaluateTone, improveResponse, evaluateImproved],
        options: { validateInputs: false },
      });

      promptEvalWorkflow
        .then(getUserInput)
        .then(promptAgent)
        .then(evaluateTone)
        .then(improveResponse)
        .then(evaluateImproved)
        .commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-workflow': promptEvalWorkflow,
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

      const run = await promptEvalWorkflow.createRun();

      const { stream, getWorkflowState } = run.streamLegacy({ inputData: { input: 'test' } });

      for await (const data of stream) {
        if (data.type === 'workflow-step-suspended') {
          expect(promptAgentAction).toHaveBeenCalledTimes(1);

          // make it async to show that execution is not blocked
          setImmediate(() => {
            const resumeData = { stepId: 'promptAgent', context: { userInput: 'test input for resumption' } };
            run.resume({ resumeData: resumeData as any, step: promptAgent });
          });
          expect(evaluateToneAction).not.toHaveBeenCalledTimes(1);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
      const resumeResult = await getWorkflowState();

      srv.close();

      expect(evaluateToneAction).toHaveBeenCalledTimes(1);
      expect(resumeResult.steps).toMatchObject({
        input: { input: 'test' },
        getUserInput: {
          status: 'success',
          output: { userInput: 'test input' },
          payload: { input: 'test' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        promptAgent: {
          status: 'success',
          output: { modelOutput: 'test output' },
          payload: { userInput: 'test input' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          resumePayload: { stepId: 'promptAgent', context: { userInput: 'test input for resumption' } },
          resumedAt: expect.any(Number),
          // suspendedAt: expect.any(Number),
        },
        evaluateToneConsistency: {
          status: 'success',
          output: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
          payload: { modelOutput: 'test output' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        improveResponse: {
          status: 'success',
          output: { improvedOutput: 'improved output' },
          payload: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        evaluateImprovedResponse: {
          status: 'success',
          output: { toneScore: { score: 0.9 }, completenessScore: { score: 0.8 } },
          payload: { improvedOutput: 'improved output' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });
    });

    it('should be able to use an agent as a step', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({
          prompt1: z.string(),
          prompt2: z.string(),
        }),
        outputSchema: z.object({}),
      });

      const agent = new Agent({
        id: 'test-agent-1',
        name: 'test-agent-1',
        instructions: 'test agent instructions"',
        model: new MockLanguageModelV1({
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                { type: 'text-delta', textDelta: 'Paris' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  logprobs: undefined,
                  usage: { completionTokens: 10, promptTokens: 3 },
                },
              ],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        }),
      });

      const agent2 = new Agent({
        id: 'test-agent-2',
        name: 'test-agent-2',
        instructions: 'test agent instructions',
        model: new MockLanguageModelV1({
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                { type: 'text-delta', textDelta: 'London' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  logprobs: undefined,
                  usage: { completionTokens: 10, promptTokens: 3 },
                },
              ],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        }),
      });

      const startStep = createStep({
        id: 'start',
        inputSchema: z.object({
          prompt1: z.string(),
          prompt2: z.string(),
        }),
        outputSchema: z.object({ prompt1: z.string(), prompt2: z.string() }),
        execute: async ({ inputData }) => {
          return {
            prompt1: inputData.prompt1,
            prompt2: inputData.prompt2,
          };
        },
      });

      const agentStep1 = createStep(agent);
      const agentStep2 = createStep(agent2);

      workflow
        .then(startStep)
        .map({
          prompt: {
            step: startStep,
            path: 'prompt1',
          },
        })
        .then(agentStep1)
        .map({
          prompt: {
            step: startStep,
            path: 'prompt2',
          },
        })
        .then(agentStep2)
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

      const run = await workflow.createRun({
        runId: 'test-run-id',
      });
      const { stream } = run.streamLegacy({
        inputData: {
          prompt1: 'Capital of France, just the name',
          prompt2: 'Capital of UK, just the name',
        },
      });

      const values: StreamEvent[] = [];
      for await (const value of stream.values()) {
        values.push(value);
      }

      srv.close();

      // Updated to new vNext streaming format
      const expectedValues = [
        {
          payload: {
            runId: 'test-run-id',
          },
          type: 'start',
        },
        {
          payload: {
            id: 'start',
            payload: {
              prompt1: 'Capital of France, just the name',
              prompt2: 'Capital of UK, just the name',
            },
            startedAt: expect.any(Number),
            status: 'running',
          },
          type: 'step-start',
        },
        {
          payload: {
            id: 'start',
            endedAt: expect.any(Number),
            output: {
              prompt1: 'Capital of France, just the name',
              prompt2: 'Capital of UK, just the name',
            },
            status: 'success',
          },
          type: 'step-result',
        },
        {
          payload: {
            id: 'start',
            metadata: {},
          },
          type: 'step-finish',
        },
        {
          payload: {
            id: expect.any(String),
          },
          type: 'step-start',
        },
        {
          payload: {
            id: expect.any(String),
            output: {
              prompt: 'Capital of France, just the name',
            },
            status: 'success',
          },
          type: 'step-result',
        },
        {
          payload: {
            id: expect.any(String),
            metadata: {},
          },
          type: 'step-finish',
        },
        {
          payload: {
            id: 'test-agent-1',
          },
          type: 'step-start',
        },
        {
          args: {
            prompt: 'Capital of France, just the name',
          },
          name: 'test-agent-1',
          type: 'tool-call-streaming-start',
        },
        {
          args: {
            prompt: 'Capital of France, just the name',
          },
          argsTextDelta: 'Paris',
          name: 'test-agent-1',
          type: 'tool-call-delta',
        },
        {
          args: {
            prompt: 'Capital of France, just the name',
          },
          name: 'test-agent-1',
          type: 'tool-call-streaming-finish',
        },
        {
          payload: {
            id: 'test-agent-1',
            output: {
              text: 'Paris',
            },
            status: 'success',
          },
          type: 'step-result',
        },
        {
          payload: {
            id: expect.any(String),
            metadata: {},
          },
          type: 'step-finish',
        },
        {
          payload: {
            id: expect.any(String),
          },
          type: 'step-start',
        },
        {
          payload: {
            id: expect.any(String),
            output: {
              prompt: 'Capital of UK, just the name',
            },
            status: 'success',
          },
          type: 'step-result',
        },
        {
          payload: {
            id: expect.any(String),
            metadata: {},
          },
          type: 'step-finish',
        },
        {
          payload: {
            id: expect.any(String),
          },
          type: 'step-start',
        },
        {
          args: {
            prompt: 'Capital of UK, just the name',
          },
          name: 'test-agent-2',
          type: 'tool-call-streaming-start',
        },
        {
          args: {
            prompt: 'Capital of UK, just the name',
          },
          argsTextDelta: 'London',
          name: 'test-agent-2',
          type: 'tool-call-delta',
        },
        {
          args: {
            prompt: 'Capital of UK, just the name',
          },
          name: 'test-agent-2',
          type: 'tool-call-streaming-finish',
        },
        {
          payload: {
            id: expect.any(String),
            output: {
              text: 'London',
            },
            status: 'success',
          },
          type: 'step-result',
        },
        {
          payload: {
            id: expect.any(String),
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
      ];
      values.forEach((value, i) => {
        const expectedValue = expectedValues[i];
        expect(value).toMatchObject(expectedValue);
      });
    });

    describe('Workflow integration', () => {
      let mockScorers: MastraScorer[];
      beforeEach(() => {
        const createMockScorer = (name: string, score: number = 0.8): MastraScorer => {
          const scorer = createScorer({
            id: `mock-scorer-${name}`,
            description: 'Mock scorer',
            name,
          }).generateScore(() => {
            return score;
          });

          vi.spyOn(scorer, 'run');

          return scorer;
        };

        vi.clearAllMocks();
        mockScorers = [createMockScorer('toxicity', 0.9), createMockScorer('relevance', 0.7)];
      });

      it('should run experiment with workflow target', async ctx => {
        const inngest = new Inngest({
          id: 'mastra',
          baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
          middleware: [realtimeMiddleware()],
        });

        const { createWorkflow, createStep } = init(inngest);

        // Create a simple workflow
        const mockStep = createStep({
          id: 'test-step',
          inputSchema: z.object({ input: z.string() }),
          outputSchema: z.object({ output: z.string() }),
          execute: async ({ inputData }) => {
            return { output: `Processed: ${inputData.input}` };
          },
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({ input: z.string() }),
          outputSchema: z.object({ output: z.string() }),
        })
          .then(mockStep)
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

        const result = await runEvals({
          data: [
            { input: { input: 'Test input 1' }, groundTruth: 'Expected 1' },
            { input: { input: 'Test input 2' }, groundTruth: 'Expected 2' },
          ],
          scorers: [mockScorers[0]],
          target: workflow,
        });
        srv.close();
        expect(result.scores.toxicity).toBe(0.9);
        expect(result.summary.totalItems).toBe(2);
      });
    });
  });

  describe('Streaming (vNext)', () => {
    it('should generate a stream', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1Action = vi.fn<any>().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'success2' });

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
          // stepId: 'step1',
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
          // stepId: 'step2',
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

    it('should handle basic sleep waiting flow', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1Action = vi.fn<any>().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'success2' });

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

      expect(watchData.length).toBe(8);
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
            startedAt: expect.any(Number),
            payload: {},
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
            id: expect.any(String),
            startedAt: expect.any(Number),
            status: 'waiting',
            payload: {
              result: 'success1',
            },
          },
          type: 'workflow-step-waiting',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
        {
          payload: {
            id: expect.any(String),
            endedAt: expect.any(Number),
            status: 'success',
            output: {
              result: 'success1',
            },
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

    it('should handle basic suspend and resume flow', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
      const promptAgentAction = vi
        .fn()
        .mockImplementationOnce(async ({ suspend }) => {
          console.log('suspend');
          await suspend();
          return undefined;
        })
        .mockImplementationOnce(() => ({ modelOutput: 'test output' }));
      const evaluateToneAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.8 },
        completenessScore: { score: 0.7 },
      });
      const improveResponseAction = vi.fn().mockResolvedValue({ improvedOutput: 'improved output' });
      const evaluateImprovedAction = vi.fn().mockResolvedValue({
        toneScore: { score: 0.9 },
        completenessScore: { score: 0.8 },
      });

      const getUserInput = createStep({
        id: 'getUserInput',
        execute: getUserInputAction,
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ userInput: z.string() }),
      });
      const promptAgent = createStep({
        id: 'promptAgent',
        execute: promptAgentAction,
        inputSchema: z.object({ userInput: z.string() }),
        outputSchema: z.object({ modelOutput: z.string() }),
      });
      const evaluateTone = createStep({
        id: 'evaluateToneConsistency',
        execute: evaluateToneAction,
        inputSchema: z.object({ modelOutput: z.string() }),
        outputSchema: z.object({
          toneScore: z.any(),
          completenessScore: z.any(),
        }),
      });
      const improveResponse = createStep({
        id: 'improveResponse',
        execute: improveResponseAction,
        inputSchema: z.object({ toneScore: z.any(), completenessScore: z.any() }),
        outputSchema: z.object({ improvedOutput: z.string() }),
      });
      const evaluateImproved = createStep({
        id: 'evaluateImprovedResponse',
        execute: evaluateImprovedAction,
        inputSchema: z.object({ improvedOutput: z.string() }),
        outputSchema: z.object({
          toneScore: z.any(),
          completenessScore: z.any(),
        }),
      });

      const promptEvalWorkflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({}),
        steps: [getUserInput, promptAgent, evaluateTone, improveResponse, evaluateImproved],
        options: { validateInputs: false },
      });

      promptEvalWorkflow
        .then(getUserInput)
        .then(promptAgent)
        .then(evaluateTone)
        .then(improveResponse)
        .then(evaluateImproved)
        .commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-workflow': promptEvalWorkflow,
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

      const run = await promptEvalWorkflow.createRun();

      const streamOutput = run.streamVNext({ inputData: { input: 'test' } });

      for await (const _data of streamOutput.fullStream) {
      }
      const resumeData = { stepId: 'promptAgent', context: { userInput: 'test input for resumption' } };
      const resumeStreamOutput = run.resumeStreamVNext({ resumeData, step: promptAgent });

      for await (const _data of resumeStreamOutput.fullStream) {
      }

      const resumeResult = await resumeStreamOutput.result;

      srv.close();

      expect(evaluateToneAction).toHaveBeenCalledTimes(1);
      expect(resumeResult.steps).toMatchObject({
        input: { input: 'test' },
        getUserInput: {
          status: 'success',
          output: { userInput: 'test input' },
          payload: { input: 'test' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        promptAgent: {
          status: 'success',
          output: { modelOutput: 'test output' },
          payload: { userInput: 'test input' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          resumePayload: { stepId: 'promptAgent', context: { userInput: 'test input for resumption' } },
          resumedAt: expect.any(Number),
          // suspendedAt: expect.any(Number),
        },
        evaluateToneConsistency: {
          status: 'success',
          output: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
          payload: { modelOutput: 'test output' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        improveResponse: {
          status: 'success',
          output: { improvedOutput: 'improved output' },
          payload: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        evaluateImprovedResponse: {
          status: 'success',
          output: { toneScore: { score: 0.9 }, completenessScore: { score: 0.8 } },
          payload: { improvedOutput: 'improved output' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });
    });

    it('should be able to use an agent as a step', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({
          prompt1: z.string(),
          prompt2: z.string(),
        }),
        outputSchema: z.object({}),
      });

      const agent = new Agent({
        id: 'test-agent-1',
        name: 'test-agent-1',
        instructions: 'test agent instructions"',
        model: new MockLanguageModelV1({
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                { type: 'text-delta', textDelta: 'Paris' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  logprobs: undefined,
                  usage: { completionTokens: 10, promptTokens: 3 },
                },
              ],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        }),
      });

      const agent2 = new Agent({
        id: 'test-agent-2',
        name: 'test-agent-2',
        instructions: 'test agent instructions',
        model: new MockLanguageModelV1({
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                { type: 'text-delta', textDelta: 'London' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  logprobs: undefined,
                  usage: { completionTokens: 10, promptTokens: 3 },
                },
              ],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        }),
      });

      const startStep = createStep({
        id: 'start',
        inputSchema: z.object({
          prompt1: z.string(),
          prompt2: z.string(),
        }),
        outputSchema: z.object({ prompt1: z.string(), prompt2: z.string() }),
        execute: async ({ inputData }) => {
          return {
            prompt1: inputData.prompt1,
            prompt2: inputData.prompt2,
          };
        },
      });

      const agentStep1 = createStep(agent);
      const agentStep2 = createStep(agent2);

      workflow
        .then(startStep)
        .map({
          prompt: {
            step: startStep,
            path: 'prompt1',
          },
        })
        .then(agentStep1)
        .map({
          prompt: {
            step: startStep,
            path: 'prompt2',
          },
        })
        .then(agentStep2)
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

      const run = await workflow.createRun({
        runId: 'test-run-id',
      });
      const streamOutput = run.stream({
        inputData: {
          prompt1: 'Capital of France, just the name',
          prompt2: 'Capital of UK, just the name',
        },
      });

      const values: StreamEvent[] = [];
      const agentEvents: StreamEvent[] = [];
      for await (const value of streamOutput.fullStream) {
        if (value.type !== 'workflow-step-output') {
          values.push(value);
        } else {
          agentEvents.push(value);
        }
      }

      srv.close();

      // @ts-ignore
      expect(agentEvents.map(event => event?.payload?.output?.type)).toEqual([
        'step-start',
        'text-delta',
        'finish',
        'step-finish',
        'step-start',
        'text-delta',
        'step-finish',
        'finish',
      ]);

      // Updated to new vNext streaming format
      const expectedValues = [
        {
          payload: {},
          type: 'workflow-start',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
        {
          payload: {
            id: 'start',
            payload: {
              prompt1: 'Capital of France, just the name',
              prompt2: 'Capital of UK, just the name',
            },
            startedAt: expect.any(Number),
            status: 'running',
          },
          type: 'workflow-step-start',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
        {
          payload: {
            id: 'start',
            endedAt: expect.any(Number),
            output: {
              prompt1: 'Capital of France, just the name',
              prompt2: 'Capital of UK, just the name',
            },
            status: 'success',
          },
          type: 'workflow-step-result',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
        {
          payload: {
            id: expect.any(String),
            payload: {
              prompt1: 'Capital of France, just the name',
              prompt2: 'Capital of UK, just the name',
            },
            startedAt: expect.any(Number),
            status: 'running',
          },
          type: 'workflow-step-start',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
        {
          payload: {
            id: expect.any(String),
            endedAt: expect.any(Number),
            output: {
              prompt: 'Capital of France, just the name',
            },
            status: 'success',
          },
          type: 'workflow-step-result',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
        {
          payload: {
            id: 'test-agent-1',
            payload: {
              prompt: 'Capital of France, just the name',
            },
            startedAt: expect.any(Number),
            status: 'running',
          },
          type: 'workflow-step-start',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
        {
          payload: {
            id: 'test-agent-1',
            output: {
              text: 'Paris',
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
            id: expect.any(String),
            payload: {
              text: 'Paris',
            },
            startedAt: expect.any(Number),
            status: 'running',
          },
          type: 'workflow-step-start',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
        {
          payload: {
            id: expect.any(String),
            endedAt: expect.any(Number),
            output: {
              prompt: 'Capital of UK, just the name',
            },
            status: 'success',
          },
          type: 'workflow-step-result',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
        {
          payload: {
            id: expect.any(String),
            payload: {
              prompt: 'Capital of UK, just the name',
            },
            startedAt: expect.any(Number),
            status: 'running',
          },
          type: 'workflow-step-start',
          from: 'WORKFLOW',
          runId: 'test-run-id',
        },
        {
          args: {
            prompt: 'Capital of UK, just the name',
          },
          name: 'test-agent-2',
          type: 'tool-call-streaming-start',
        },
        {
          args: {
            prompt: 'Capital of UK, just the name',
          },
          argsTextDelta: 'London',
          name: 'test-agent-2',
          type: 'tool-call-delta',
        },
        {
          args: {
            prompt: 'Capital of UK, just the name',
          },
          name: 'test-agent-2',
          type: 'tool-call-streaming-finish',
        },
        {
          payload: {
            id: expect.any(String),
            output: {
              text: 'London',
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
      ];
      values.forEach((value, i) => {
        const expectedValue = expectedValues[i];
        expect(value).toMatchObject(expectedValue);
      });
    });

    describe('Workflow integration', () => {
      let mockScorers: MastraScorer[];
      beforeEach(() => {
        const createMockScorer = (name: string, score: number = 0.8): MastraScorer => {
          const scorer = createScorer({
            id: `mock-scorer-${name}`,
            description: 'Mock scorer',
            name,
          }).generateScore(() => {
            return score;
          });

          vi.spyOn(scorer, 'run');

          return scorer;
        };

        vi.clearAllMocks();
        mockScorers = [createMockScorer('toxicity', 0.9), createMockScorer('relevance', 0.7)];
      });

      it('should run experiment with workflow target', async ctx => {
        const inngest = new Inngest({
          id: 'mastra',
          baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
          middleware: [realtimeMiddleware()],
        });

        const { createWorkflow, createStep } = init(inngest);

        // Create a simple workflow
        const mockStep = createStep({
          id: 'test-step',
          inputSchema: z.object({ input: z.string() }),
          outputSchema: z.object({ output: z.string() }),
          execute: async ({ inputData }) => {
            return { output: `Processed: ${inputData.input}` };
          },
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({ input: z.string() }),
          outputSchema: z.object({ output: z.string() }),
        })
          .then(mockStep)
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

        const result = await runEvals({
          data: [
            { input: { input: 'Test input 1' }, groundTruth: 'Expected 1' },
            { input: { input: 'Test input 2' }, groundTruth: 'Expected 2' },
          ],
          scorers: [mockScorers[0]],
          target: workflow,
        });
        srv.close();
        expect(result.scores.toxicity).toBe(0.9);
        expect(result.summary.totalItems).toBe(2);
      });
    });
  });

  describe.sequential('Flow Control Configuration', () => {
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
  });

  describe('serve function with user-supplied functions', () => {
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

  describe('Workflow Runs', () => {
    it('should use shouldPersistSnapshot option', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);
      const step1Action = vi.fn<any>().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'success2' });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const resumeStep = createStep({
        id: 'resume-step',
        execute: async ({ resumeData, suspend }) => {
          if (!resumeData) {
            return suspend({});
          }
          return { completed: true };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({ completed: z.boolean() }),
        resumeSchema: z.object({ resume: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ completed: z.boolean() }),
        options: { shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus === 'suspended' },
      });
      workflow.then(step1).then(step2).then(resumeStep).commit();

      const mastra = new Mastra({
        workflows: {
          'test-workflow': workflow,
        },
        logger: false,
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

      // Create a few runs
      const run1 = await workflow.createRun();
      await run1.start({ inputData: {} });

      const { runs, total } = await workflow.listWorkflowRuns();
      expect(total).toBe(1);
      expect(runs).toHaveLength(1);

      await run1.resume({ resumeData: { resume: 'resume' }, step: 'resume-step' });

      const { runs: afterResumeRuns, total: afterResumeTotal } = await workflow.listWorkflowRuns();
      expect(afterResumeTotal).toBe(1);
      expect(afterResumeRuns).toHaveLength(1);
      expect(afterResumeRuns.map(r => r.runId)).toEqual(expect.arrayContaining([run1.runId]));
      expect(afterResumeRuns[0]?.workflowName).toBe('test-workflow');
      expect(afterResumeRuns[0]?.snapshot).toBeDefined();
      expect((afterResumeRuns[0]?.snapshot as any).status).toBe('suspended');

      srv.close();
    });

    it('should get workflow run by id from storage', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);
      const step1Action = vi.fn<any>().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn<any>().mockResolvedValue({ result: 'success2' });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Action,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({ id: 'test-workflow', inputSchema: z.object({}), outputSchema: z.object({}) });
      workflow.then(step1).then(step2).commit();

      const mastra = new Mastra({
        logger: false,
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

      // Create a few runs
      const run1 = await workflow.createRun();
      await run1.start({ inputData: {} });

      const { runs, total } = await workflow.listWorkflowRuns();
      expect(total).toBe(1);
      expect(runs).toHaveLength(1);
      expect(runs.map(r => r.runId)).toEqual(expect.arrayContaining([run1.runId]));
      expect(runs[0]?.workflowName).toBe('test-workflow');
      expect(runs[0]?.snapshot).toBeDefined();

      const run3 = await workflow.getWorkflowRunById(run1.runId);
      expect(run3?.runId).toBe(run1.runId);
      expect(run3?.workflowName).toBe('test-workflow');
      expect(run3?.snapshot).toEqual(runs[0].snapshot);
      srv.close();
    });
  });
}, 80e3);
