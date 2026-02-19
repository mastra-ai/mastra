import fs from 'node:fs';
import path from 'node:path';
import { openai } from '@ai-sdk/openai';
import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import { realtimeMiddleware } from '@inngest/realtime/middleware';
import { createWorkflowTestSuite } from '@internal/workflow-test-utils';
import type { WorkflowResult, WorkflowRegistry, ResumeWorkflowOptions } from '@internal/workflow-test-utils';
import { Agent } from '@mastra/core/agent';
import { MastraError } from '@mastra/core/error';
import type { MastraScorer } from '@mastra/core/evals';
import { createScorer, runEvals } from '@mastra/core/evals';
import { Mastra } from '@mastra/core/mastra';
import type { ObservabilityExporter, TracingEvent } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import { MockStore } from '@mastra/core/storage';
import {
  MastraLanguageModelV2Mock as MockLanguageModelV2,
  simulateReadableStream,
} from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import type { StreamEvent } from '@mastra/core/workflows';
import { createHonoServer } from '@mastra/deployer/server';
import { DefaultStorage } from '@mastra/libsql';
import { Observability } from '@mastra/observability';
import { MockLanguageModelV1 } from 'ai/test';
import { execaCommand } from 'execa';
import type { ResultPromise } from 'execa';
import { Inngest } from 'inngest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { z } from 'zod';
import type { InngestWorkflow } from './workflow';
import { init, serve as inngestServe } from './index';

interface LocalTestContext {
  inngestPort: number;
  handlerPort: number;
  srv?: any;
}

// Inngest dev server process (managed via inngest-cli, no Docker required)
let standaloneInngestProcess: ResultPromise | null = null;

/**
 * Start a fresh inngest-cli dev server, killing any existing one first.
 * Replaces the old `docker compose restart` pattern.
 */
async function resetInngest() {
  // Kill existing inngest dev server if running
  if (standaloneInngestProcess) {
    standaloneInngestProcess.kill();
    standaloneInngestProcess = null;
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Start inngest-cli dev server
  standaloneInngestProcess = execaCommand(
    `npx inngest-cli dev -p 4000 -u http://localhost:4001/inngest/api --poll-interval=1 --retry-interval=1`,
    { cwd: import.meta.dirname, stdio: 'ignore', reject: false },
  );

  // Wait for it to be ready
  for (let i = 0; i < 30; i++) {
    try {
      const response = await fetch('http://localhost:4000/dev');
      if (response.ok) break;
    } catch {
      // Keep trying
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Trigger registration by sending PUT to the handler
  try {
    await fetch('http://localhost:4001/inngest/api', { method: 'PUT' });
  } catch {
    // Ignore
  }

  // Wait for function registration
  for (let i = 0; i < 20; i++) {
    try {
      const response = await fetch('http://localhost:4000/dev');
      const data = await response.json();
      if (data.functions?.length > 0) return;
    } catch {
      // Keep trying
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

describe('MastraInngestWorkflow', () => {
  let globServer: any;

  beforeEach<LocalTestContext>(async ctx => {
    ctx.inngestPort = 4000;
    ctx.handlerPort = 4001;

    globServer?.close();

    vi.restoreAllMocks();
  });

  afterAll(async () => {
    globServer?.close();
    if (standaloneInngestProcess) {
      standaloneInngestProcess.kill();
      standaloneInngestProcess = null;
    }
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
      const result = await run.start({ inputData: {} });

      expect(execute).toHaveBeenCalled();
      expect(result.steps['step1']).toMatchObject({
        status: 'success',
        output: { result: 'success' },
      });

      srv.close();
    });

    it('should execute a single step in a workflow when perStep is true', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
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
        options: {
          validateInputs: false,
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

      const runId = 'test-run-id';
      const run = await workflow.createRun({
        runId,
      });

      const executionResult = await run.start({ inputData: {}, perStep: true });

      srv.close();
      // Verify execution completed successfully
      expect(executionResult.steps.step1).toEqual({
        status: 'success',
        output: { result: 'success1' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });

      expect(executionResult.steps.step2).toBeUndefined();
      expect((executionResult as any).result).toBeUndefined();
      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).not.toHaveBeenCalled();
      expect(executionResult.status).toBe('paused');
    });

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

    it('should execute multiple runs of a workflow', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);
      const step1 = createStep({
        id: 'step1',
        execute: async ({ state, setState, requestContext }) => {
          const newState = state.value + '!!!';
          const testValue = requestContext.get('testKey');
          requestContext.set('randomKey', newState + testValue);
          await setState({ value: newState });
          return { result: 'success', value: newState };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string(), value: z.string() }),
        stateSchema: z.object({
          value: z.string(),
        }),
      });

      const step2 = createStep({
        id: 'step2',
        inputSchema: z.object({ result: z.string(), value: z.string() }),
        outputSchema: z.object({ result: z.string(), value: z.string(), randomValue: z.string() }),
        stateSchema: z.object({
          value: z.string(),
        }),
        execute: async ({ inputData, requestContext }) => {
          const randomValue = requestContext.get('randomKey') as string;
          return { ...inputData, randomValue };
        },
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.string(),
          value: z.string(),
          randomValue: z.string(),
        }),
        stateSchema: z.object({
          value: z.string(),
          otherValue: z.string(),
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

      const [result1, result2] = await Promise.all([
        (async () => {
          const requestContext = new RequestContext();
          requestContext.set('testKey', 'test-value-one');
          const run = await workflow.createRun();
          const result = await run.start({
            inputData: {},
            initialState: { value: 'test-state-one', otherValue: 'test-other-state-one' },
            outputOptions: {
              includeState: true,
            },
            requestContext,
          });
          return result;
        })(),
        (async () => {
          const requestContext = new RequestContext();
          requestContext.set('testKey', 'test-value-two');
          const run = await workflow.createRun();
          const result = await run.start({
            inputData: {},
            initialState: { value: 'test-state-two', otherValue: 'test-other-state-two' },
            outputOptions: {
              includeState: true,
            },
            requestContext,
          });
          return result;
        })(),
      ]);

      srv.close();

      expect(result1.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'success', value: 'test-state-one!!!' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(result1.steps['step2']).toEqual({
        status: 'success',
        output: { result: 'success', value: 'test-state-one!!!', randomValue: 'test-state-one!!!test-value-one' },
        payload: { result: 'success', value: 'test-state-one!!!' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(result1.state).toEqual({ value: 'test-state-one!!!', otherValue: 'test-other-state-one' });
      expect(result2.steps['step1']).toEqual({
        status: 'success',
        output: { result: 'success', value: 'test-state-two!!!' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(result2.steps['step2']).toEqual({
        status: 'success',
        output: { result: 'success', value: 'test-state-two!!!', randomValue: 'test-state-two!!!test-value-two' },
        payload: { result: 'success', value: 'test-state-two!!!' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(result2.state).toEqual({ value: 'test-state-two!!!', otherValue: 'test-other-state-two' });
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

    it('should execute a single step in a nested workflow when perStep is true', async ctx => {
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
          await setState({ ...state, value: state.value + '!!!' });
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
      });

      workflow.then(nestedWorkflow).commit();

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
        perStep: true,
      });

      srv.close();

      expect(calls).toBe(1);
      expect(result.status).toBe('paused');
      expect(result.steps['nested-workflow']).toEqual({
        status: 'paused',
        payload: {},
        startedAt: expect.any(Number),
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
          await setState({ ...state, value: state.value + '!!!' });
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

    it('should execute only one step when there are multiple steps in parallel and perStep is true', async ctx => {
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
      const result = await run.start({ inputData: {}, perStep: true });

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).not.toHaveBeenCalled();
      expect(result.steps).toEqual({
        input: {},
        step1: {
          status: 'success',
          output: { value: 'step1' },
          payload: {},

          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });
      expect(result.status).toBe('paused');

      const workflowRun = await workflow.getWorkflowRunById(run.runId);

      expect(workflowRun?.status).toBe('paused');
      expect(workflowRun?.steps).toEqual({
        step1: {
          status: 'success',
          output: { value: 'step1' },
          payload: {},

          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
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

    it('should persist a workflow run with resourceId', async ctx => {
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

      const execute = vi.fn().mockResolvedValue({ result: 'success' });

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

      const execute = vi.fn().mockResolvedValue({ result: 'success' });
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

      const execute = vi.fn().mockResolvedValue({ result: 'success' });
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

      const step1Action = vi.fn().mockResolvedValue({
        nested: { value: 'step1-data' },
      });
      const step2Action = vi.fn().mockResolvedValue({ result: 'success' });

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

    it('should follow conditional chains and run only one step when perStep is true', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const step2Action = vi.fn().mockImplementation(() => {
        return Promise.resolve({ result: 'step2' });
      });
      const step3Action = vi.fn().mockImplementation(() => {
        return Promise.resolve({ result: 'step3' });
      });
      const step5Action = vi.fn().mockImplementation(() => {
        return Promise.resolve({ result: 'step5' });
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
      const step5 = createStep({
        id: 'step5',
        execute: step5Action,
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ step5Result: z.string() }),
      });
      const step4 = createStep({
        id: 'step4',
        execute: async ({ inputData }) => {
          return { result: inputData.result + inputData.step5Result };
        },
        inputSchema: z.object({ result: z.string(), step5Result: z.string().optional() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      });

      workflow
        .branch([
          [
            async ({ inputData }) => {
              return inputData.status === 'success';
            },
            step2,
          ],
          [
            async ({ inputData }) => {
              return inputData.status === 'success';
            },
            step5,
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
            step: [step3, step2, step5],
            path: 'result',
          },
          step5Result: {
            step: step5,
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
      const result = await run.start({
        inputData: {
          status: 'success',
        },
        perStep: true,
      });

      srv.close();

      expect(step2Action).toHaveBeenCalled();
      expect(step3Action).not.toHaveBeenCalled();
      expect(step5Action).not.toHaveBeenCalled();
      expect(result.steps).toMatchObject({
        input: { status: 'success' },
        step2: { status: 'success', output: { result: 'step2' } },
      });
      expect(result.steps.step5).toBeUndefined();
      expect(result.status).toBe('paused');
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
      const step1Action = vi.fn().mockImplementation(() => {
        err = new Error('Failed');
        throw err;
      });
      const step2Action = vi.fn();

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
      expect(result?.steps?.input).toEqual({});
      expect(result?.steps?.step1.status).toBe('failed');
      expect(result?.steps?.step1.error).toBeInstanceOf(Error);
      expect((result?.steps?.step1.error as Error).message).toBe('Failed');
    });

    it('should support simple string conditions', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1Action = vi.fn().mockResolvedValue({ status: 'success' });
      const step2Action = vi.fn().mockResolvedValue({ result: 'step2' });
      const step3Action = vi.fn().mockResolvedValue({ result: 'step3' });
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

      const step1Action = vi.fn().mockResolvedValue({ count: 5 });
      const step2Action = vi.fn();

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
      const failingAction = vi.fn().mockRejectedValue(error);

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

      const result = await run.start({ inputData: {} });

      expect(result.steps.step1.status).toBe('failed');
      // Error should be an Error instance (re-hydrated from serialized form)
      expect(result.steps.step1.error).toBeInstanceOf(Error);
      expect((result.steps.step1.error as Error).message).toBe('Step execution failed');

      srv.close();
    });

    it('should preserve custom error properties through Inngest serialization', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      // Create an error with custom properties (like AIAPICallError from AI SDK)
      const customError = new Error('API rate limit exceeded');
      (customError as any).statusCode = 429;
      (customError as any).responseHeaders = { 'retry-after': '60' };
      (customError as any).isRetryable = true;

      const failingAction = vi.fn().mockRejectedValue(customError);

      const step1 = createStep({
        id: 'step1',
        execute: failingAction,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-error-props-workflow',
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
          'test-error-props-workflow': workflow,
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

      expect(result.status).toBe('failed');

      // Step-level error should be an Error instance with custom properties preserved
      const stepError = result.steps.step1;
      expect(stepError.status).toBe('failed');
      expect(stepError.error).toBeInstanceOf(Error);
      expect((stepError.error as Error).message).toBe('API rate limit exceeded');
      // Custom properties should be preserved through serialization/deserialization
      expect((stepError.error as any).statusCode).toBe(429);
      expect((stepError.error as any).responseHeaders).toEqual({ 'retry-after': '60' });
      expect((stepError.error as any).isRetryable).toBe(true);

      // Workflow-level error should also be an Error instance
      // Note: In Inngest, the workflow-level error comes from formatResultError
      // which uses the step's error (the original error with all its properties)
      if (result.status === 'failed') {
        expect(result.error).toBeInstanceOf(Error);
        // The workflow-level error should have the original error message
        // (formatResultError gets the error from the step result)
        expect((result.error as Error).message).toBe('API rate limit exceeded');
        // Custom properties should also be preserved on workflow-level error
        expect((result.error as any).statusCode).toBe(429);
        expect((result.error as any).responseHeaders).toEqual({ 'retry-after': '60' });
        expect((result.error as any).isRetryable).toBe(true);
      }

      srv.close();
    });

    it('should preserve error cause chains through Inngest serialization', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      // Create a nested error with cause chain
      const rootCause = new Error('Database connection failed');
      (rootCause as any).code = 'ECONNREFUSED';
      (rootCause as any).host = 'localhost';
      (rootCause as any).port = 5432;

      const middleCause = new Error('Query execution failed', { cause: rootCause });
      (middleCause as any).query = 'SELECT * FROM users';

      const topError = new Error('Failed to fetch user data', { cause: middleCause });
      (topError as any).userId = '12345';

      const failingAction = vi.fn().mockRejectedValue(topError);

      const step1 = createStep({
        id: 'step1',
        execute: failingAction,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWorkflow({
        id: 'test-error-cause-chain-workflow',
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
          'test-error-cause-chain-workflow': workflow,
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

      expect(result.status).toBe('failed');

      // Step-level error should preserve the cause chain
      const stepError = result.steps.step1;
      expect(stepError.status).toBe('failed');
      expect(stepError.error).toBeInstanceOf(Error);
      expect((stepError.error as Error).message).toBe('Failed to fetch user data');
      expect((stepError.error as any).userId).toBe('12345');

      // Check middle cause
      const stepMiddleCause = (stepError.error as Error).cause;
      expect(stepMiddleCause).toBeDefined();
      expect((stepMiddleCause as Error).message).toBe('Query execution failed');
      expect((stepMiddleCause as any).query).toBe('SELECT * FROM users');

      // Check root cause
      const stepRootCause = (stepMiddleCause as Error).cause;
      expect(stepRootCause).toBeDefined();
      expect((stepRootCause as Error).message).toBe('Database connection failed');
      expect((stepRootCause as any).code).toBe('ECONNREFUSED');
      expect((stepRootCause as any).host).toBe('localhost');
      expect((stepRootCause as any).port).toBe(5432);

      // Workflow-level error should also preserve the cause chain
      if (result.status === 'failed') {
        expect(result.error).toBeInstanceOf(Error);
        expect((result.error as Error).message).toBe('Failed to fetch user data');

        const workflowMiddleCause = (result.error as Error).cause;
        expect(workflowMiddleCause).toBeDefined();
        expect((workflowMiddleCause as Error).message).toBe('Query execution failed');

        const workflowRootCause = (workflowMiddleCause as Error).cause;
        expect(workflowRootCause).toBeDefined();
        expect((workflowRootCause as Error).message).toBe('Database connection failed');
      }

      srv.close();
    });

    it('should handle step execution errors within branches', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const error = new Error('Step execution failed');
      const failingAction = vi.fn().mockRejectedValue(error);
      const successAction = vi.fn().mockResolvedValue({});

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

      expect(result.steps.step1.status).toBe('success');
      expect(result.steps.step2.status).toBe('failed');
      // Error should be an Error instance (re-hydrated from serialized form)
      expect(result.steps.step2.error).toBeInstanceOf(Error);
      expect((result.steps.step2.error as Error).message).toBe('Step execution failed');

      srv.close();
    });

    it('should handle step execution errors within nested workflows', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const error = new Error('Step execution failed');
      const failingAction = vi.fn().mockRejectedValue(error);
      const successAction = vi.fn().mockResolvedValue({});

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

      expect(result.steps['test-workflow'].status).toBe('failed');
      // Error should be an Error instance (re-hydrated from serialized form)
      expect(result.steps['test-workflow'].error).toBeInstanceOf(Error);
      expect((result.steps['test-workflow'].error as Error).message).toBe('Step execution failed');

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

      const step1Action = vi.fn().mockResolvedValue({
        status: 'partial',
        score: 75,
        flags: { isValid: true },
      });
      const step2Action = vi.fn().mockResolvedValue({ result: 'step2' });
      const step3Action = vi.fn().mockResolvedValue({ result: 'step3' });

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
      // @ts-expect-error - testing dynamic workflow result
      expect(result.result).toMatchObject({ finalValue: 12 });
      // @ts-expect-error - testing dynamic workflow result
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
      // @ts-expect-error - testing dynamic workflow result
      expect(result.result).toMatchObject({ finalValue: 12 });
      // @ts-expect-error - testing dynamic workflow result
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

    it('should run foreach with nested workflow', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      // Steps for the nested workflow (from issue #9965)
      const cyclePhasesStep1 = createStep({
        id: 'phase-1',
        description: 'phase number 1',
        inputSchema: z.object({
          element: z.string(),
        }),
        outputSchema: z.object({
          element: z.string(),
        }),
        execute: async ({ inputData }) => {
          return { element: inputData.element };
        },
      });

      const cyclePhasesStep2 = createStep({
        id: 'phase-2',
        description: 'phase number 2',
        inputSchema: z.object({
          element: z.string(),
        }),
        outputSchema: z.object({
          element: z.string(),
        }),
        execute: async ({ inputData }) => {
          return { element: inputData.element };
        },
      });

      const cyclePhasesStep3 = createStep({
        id: 'phase-3',
        description: 'phase number 3',
        inputSchema: z.object({
          element: z.string(),
        }),
        outputSchema: z.object({
          result: z.string(),
        }),
        execute: async ({ inputData }) => {
          return { result: inputData.element };
        },
      });

      // Create nested workflow with multiple steps
      const dynamicWorkflowPhases = createWorkflow({
        id: 'dynamicWorkflowPhases',
        inputSchema: z.object({
          element: z.string(),
        }),
        outputSchema: z.object({
          result: z.string(),
        }),
      })
        .then(cyclePhasesStep1)
        .then(cyclePhasesStep2)
        .then(cyclePhasesStep3)
        .commit();

      // Issue #9965: Wrap the nested workflow in createStep() - this causes the bug
      // because createStep() strips the InngestWorkflow class identity
      const dynamicWorkflowPhasesStep = createStep(dynamicWorkflowPhases);

      // Create orchestrator workflow that uses foreach with the nested workflow
      const dynamicWorkflowOrchestrator = createWorkflow({
        id: 'dynamicWorkflowOrchestrator',
        inputSchema: z.object({
          elements: z.array(z.string()),
        }),
        outputSchema: z.array(z.object({ result: z.string() })),
      })
        .map(async ({ inputData }) => {
          return inputData.elements.map(element => {
            return { element: element };
          });
        })
        .foreach(dynamicWorkflowPhasesStep)
        .commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-workflow': dynamicWorkflowOrchestrator,
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

      const run = await dynamicWorkflowOrchestrator.createRun();
      const result = await run.start({ inputData: { elements: ['a', 'b', 'c'] } });

      expect(result.status).toBe('success');
      expect(result.result).toEqual([{ result: 'a' }, { result: 'b' }, { result: 'c' }]);

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
      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps.finalIf.output).toMatchObject({ finalValue: 2 });
      // @ts-expect-error - testing dynamic workflow result
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
      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps['else-branch'].output).toMatchObject({ finalValue: 26 + 6 + 1 });
      // @ts-expect-error - testing dynamic workflow result
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
        execute: vi.fn().mockResolvedValue({ result: 'success' }),
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
            // @ts-expect-error - testing dynamic workflow result
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
        execute: vi.fn().mockResolvedValue({ result: 'success1' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step2 = createStep({
        id: 'step2',
        execute: vi.fn().mockResolvedValue({ result: 'success2' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step3 = createStep({
        id: 'step3',
        execute: vi.fn().mockResolvedValue({ result: 'success3' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step4 = createStep({
        id: 'step4',
        execute: vi.fn().mockResolvedValue({ result: 'success4' }),
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step5 = createStep({
        id: 'step5',
        execute: vi.fn().mockResolvedValue({ result: 'success5' }),
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

      const step1Execute = vi.fn().mockResolvedValue({ result: 'success' });
      const step2Execute = vi.fn().mockRejectedValue(new Error('Step failed'));

      const step1 = createStep({
        id: 'step1',
        execute: step1Execute,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Execute,
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
      expect(result.steps.step2.status).toBe('failed');
      expect(result.steps.step2.error).toBeInstanceOf(Error);
      expect((result.steps.step2.error as Error).message).toBe('Step failed');
      expect(step1Execute).toHaveBeenCalledTimes(1);
      expect(step2Execute).toHaveBeenCalledTimes(1); // 0 retries + 1 initial call
    });

    it('should retry a step with a custom retry config', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1Execute = vi.fn().mockResolvedValue({ result: 'success' });
      const step2Execute = vi.fn().mockRejectedValue(new Error('Step failed'));

      const step1 = createStep({
        id: 'step1',
        execute: step1Execute,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Execute,
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

      expect(step1Execute).toHaveBeenCalledTimes(1);
      expect(step2Execute).toHaveBeenCalledTimes(3); // 1 initial + 2 retries (retryConfig.attempts = 2)
    });

    it('should retry a step with step retries option, overriding the workflow retry config', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1Execute = vi.fn().mockResolvedValue({ result: 'success' });
      const step2Execute = vi.fn().mockRejectedValue(new Error('Step failed'));

      const step1 = createStep({
        id: 'step1',
        execute: step1Execute,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        retries: 2,
      });
      const step2 = createStep({
        id: 'step2',
        execute: step2Execute,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        retries: 2,
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        retryConfig: {
          delay: 1, // if the delay is 0 it will default to inngest's default backoff delay
          attempts: 4,
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

      expect(step1Execute).toHaveBeenCalledTimes(1);
      expect(step2Execute).toHaveBeenCalledTimes(3); // 1 initial + 2 retries (step.retries = 2)
    });
  });

  describe('Interoperability (Actions)', () => {
    it('should be able to use all action types in a workflow', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1Action = vi.fn().mockResolvedValue({ name: 'step1' });

      const step1 = createStep({
        id: 'step1',
        execute: step1Action,
        inputSchema: z.object({}),
        outputSchema: z.object({ name: z.string() }),
      });

      // @ts-expect-error - testing dynamic workflow result
      const toolAction = vi.fn().mockImplementation(async ({ name }) => {
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

    it('should handle basic suspend and resume single step flow with async await syntax and perStep:true', async ctx => {
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

      const firstResumeResult = await run.resume({ step: 'promptAgent', resumeData: newCtx, perStep: true });
      if (!firstResumeResult) {
        throw new Error('Resume failed to return a result');
      }

      srv.close();

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
          suspendPayload: { testPayload: 'hello' },
          resumePayload: { userInput: 'test input for resumption' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
          resumedAt: expect.any(Number),
        },
      });

      expect(firstResumeResult.status).toBe('paused');

      expect(promptAgentAction).toHaveBeenCalledTimes(2);
      expect(evaluateToneAction).not.toHaveBeenCalled();
      expect(evaluateImprovedAction).not.toHaveBeenCalled();
      expect(improveResponseAction).not.toHaveBeenCalled();
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
          await setState({ ...state, value: 'test state' });
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
          suspendPayload: { testPayload: 'hello' },
          suspendedAt: expect.any(Number),
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
          suspendedAt: expect.any(Number),
          suspendPayload: { testPayload: 'hello' },
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
          suspendedAt: expect.any(Number),
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
        const suspendedStepIds = initialResult.suspended.map(s => s[0]);
        expect(suspendedStepIds).toContain('branch-step-1');
        expect(suspendedStepIds).toContain('branch-step-2');
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

    it('should have access to the correct inputValue when resuming a step preceded by a .map step', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      const getUserInput = createStep({
        id: 'getUserInput',
        execute: async ({ inputData }) => {
          return {
            userInput: inputData.input,
          };
        },
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ userInput: z.string() }),
      });
      const promptAgent = createStep({
        id: 'promptAgent',
        execute: async ({ inputData, suspend, resumeData }) => {
          if (!resumeData) {
            return suspend({ testPayload: 'suspend message' });
          }

          return {
            modelOutput: inputData.userInput + ' ' + resumeData.userInput,
          };
        },
        inputSchema: z.object({ userInput: z.string() }),
        outputSchema: z.object({ modelOutput: z.string() }),
        suspendSchema: z.object({ testPayload: z.string() }),
        resumeSchema: z.object({ userInput: z.string() }),
      });
      const improveResponse = createStep({
        id: 'improveResponse',
        execute: async ({ inputData, suspend, resumeData }) => {
          if (!resumeData) {
            return suspend();
          }

          return {
            improvedOutput: 'improved output',
            overallScore: {
              completenessScore: {
                score: (inputData.completenessScore.score + resumeData.completenessScore.score) / 2,
              },
              toneScore: { score: (inputData.toneScore.score + resumeData.toneScore.score) / 2 },
            },
          };
        },
        resumeSchema: z.object({
          toneScore: z.object({ score: z.number() }),
          completenessScore: z.object({ score: z.number() }),
        }),
        inputSchema: z.object({
          toneScore: z.object({ score: z.number() }),
          completenessScore: z.object({ score: z.number() }),
        }),
        outputSchema: z.object({
          improvedOutput: z.string(),
          overallScore: z.object({
            toneScore: z.object({ score: z.number() }),
            completenessScore: z.object({ score: z.number() }),
          }),
        }),
      });
      const evaluateImproved = createStep({
        id: 'evaluateImprovedResponse',
        execute: async ({ inputData }) => {
          return inputData.overallScore;
        },
        inputSchema: z.object({
          improvedOutput: z.string(),
          overallScore: z.object({
            toneScore: z.object({ score: z.number() }),
            completenessScore: z.object({ score: z.number() }),
          }),
        }),
        outputSchema: z.object({
          toneScore: z.object({ score: z.number() }),
          completenessScore: z.object({ score: z.number() }),
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
        .map(
          async () => {
            return {
              toneScore: { score: 0.8 },
              completenessScore: { score: 0.7 },
            };
          },
          {
            id: 'evaluateToneConsistency',
          },
        )
        .then(improveResponse)
        .then(evaluateImproved)
        .commit();

      // Create a new storage instance for initial run
      const initialStorage = new DefaultStorage({
        id: 'test-storage',
        url: 'file::memory:',
      });
      const mastra = new Mastra({
        storage: initialStorage,
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
      expect(initialResult.steps).toEqual({
        input: { input: 'test' },
        getUserInput: {
          status: 'success',
          output: { userInput: 'test' },
          payload: { input: 'test' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        promptAgent: {
          status: 'suspended',
          payload: { userInput: 'test' },
          suspendPayload: {
            testPayload: 'suspend message',
          },
          startedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
        },
      });

      const newCtx = {
        userInput: 'input for resumption',
      };

      expect(initialResult.steps.promptAgent.status).toBe('suspended');

      const firstResumeResult = await run.resume({ step: 'promptAgent', resumeData: newCtx });
      if (!firstResumeResult) {
        throw new Error('Resume failed to return a result');
      }

      expect(firstResumeResult.steps).toEqual({
        input: { input: 'test' },
        getUserInput: {
          status: 'success',
          output: { userInput: 'test' },
          payload: { input: 'test' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        promptAgent: {
          status: 'success',
          output: { modelOutput: 'test input for resumption' },
          payload: { userInput: 'test' },
          suspendPayload: { testPayload: 'suspend message' },
          resumePayload: { userInput: 'input for resumption' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
          resumedAt: expect.any(Number),
        },
        evaluateToneConsistency: {
          status: 'success',
          output: {
            toneScore: { score: 0.8 },
            completenessScore: { score: 0.7 },
          },
          payload: { modelOutput: 'test input for resumption' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        improveResponse: {
          status: 'suspended',
          payload: {
            toneScore: { score: 0.8 },
            completenessScore: { score: 0.7 },
          },
          startedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
        },
      });

      const secondResumeResult = await run.resume({
        step: improveResponse,
        resumeData: {
          toneScore: { score: 0.9 },
          completenessScore: { score: 0.8 },
        },
      });
      if (!secondResumeResult) {
        throw new Error('Resume failed to return a result');
      }

      expect(secondResumeResult.steps).toEqual({
        input: { input: 'test' },
        getUserInput: {
          status: 'success',
          output: { userInput: 'test' },
          payload: { input: 'test' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        promptAgent: {
          status: 'success',
          output: { modelOutput: 'test input for resumption' },
          payload: { userInput: 'test' },
          suspendPayload: { testPayload: 'suspend message' },
          resumePayload: { userInput: 'input for resumption' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
          resumedAt: expect.any(Number),
        },
        evaluateToneConsistency: {
          status: 'success',
          output: {
            toneScore: { score: 0.8 },
            completenessScore: { score: 0.7 },
          },
          payload: { modelOutput: 'test input for resumption' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        improveResponse: {
          status: 'success',
          output: {
            improvedOutput: 'improved output',
            overallScore: { toneScore: { score: (0.8 + 0.9) / 2 }, completenessScore: { score: (0.7 + 0.8) / 2 } },
          },
          payload: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
          resumePayload: {
            toneScore: { score: 0.9 },
            completenessScore: { score: 0.8 },
          },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
          resumedAt: expect.any(Number),
        },
        evaluateImprovedResponse: {
          status: 'success',
          output: { toneScore: { score: (0.8 + 0.9) / 2 }, completenessScore: { score: (0.7 + 0.8) / 2 } },
          payload: {
            improvedOutput: 'improved output',
            overallScore: { toneScore: { score: (0.8 + 0.9) / 2 }, completenessScore: { score: (0.7 + 0.8) / 2 } },
          },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });

      srv.close();
    });
  });

  describe('Time travel', () => {
    const testStorage = new MockStore();
    afterEach(async () => {
      const workflowsStore = await testStorage.getStore('workflows');
      await workflowsStore?.dangerouslyClearAll();
    });

    it('should throw error if trying to timetravel a workflow execution that is still running', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const execute = vi.fn().mockResolvedValue({ step1Result: 2 });
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

      const workflowsStore = await testStorage.getStore('workflows');
      expect(workflowsStore).toBeDefined();
      await workflowsStore?.persistWorkflowSnapshot({
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

      const execute = vi.fn().mockResolvedValue({ step1Result: 2 });
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

      const execute = vi.fn().mockResolvedValue({ step1Result: 2 });
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

      const execute = vi.fn().mockResolvedValue({ step1Result: 2 });
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
        input: { value: 0 },
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
        input: {},
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

    it('should timeTravel a workflow execution and run only one step when perStep is true', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const execute = vi.fn().mockResolvedValue({ step1Result: 2 });
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
        perStep: true,
      });

      expect(result.status).toBe('paused');
      expect(result).toEqual({
        status: 'paused',
        input: {
          value: 0,
        },
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

      const execute = vi.fn().mockResolvedValue({ step1Result: 2 });
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
      expect(failedRun.steps.step2.status).toBe('failed');
      expect(failedRun.steps.step2.payload).toEqual({ step1Result: 2 });
      expect(failedRun.steps.step2.error).toBeInstanceOf(Error);
      expect((failedRun.steps.step2.error as Error).message).toBe('Simulated error');
      expect(failedRun.steps.step2.startedAt).toEqual(expect.any(Number));
      expect(failedRun.steps.step2.endedAt).toEqual(expect.any(Number));

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
        input: { value: 0 },
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
        input: { value: 0 },
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

    it('should timeTravel a workflow execution that was previously ran and run only one step when perStep is true', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const execute = vi.fn().mockResolvedValue({ step1Result: 2 });
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
      });

      workflow.then(step1).then(step2).then(step3).commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        server: {
          apiRoutes: [
            {
              path: '/inngest/api',
              method: 'ALL',
              createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
            },
          ],
        },
        workflows: { testWorkflow: workflow },
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
      expect(failedRun.steps.step2).toMatchObject({
        status: 'failed',
        payload: { step1Result: 2 },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      // error is now an Error instance
      expect((failedRun.steps.step2 as any).error).toBeInstanceOf(Error);
      expect((failedRun.steps.step2 as any).error.message).toBe('Simulated error');

      const result = await run.timeTravel({
        step: 'step2',
        inputData: { step1Result: 4 },
        perStep: true,
      });

      srv.close();

      expect(result.status).toBe('paused');
      expect(result).toEqual({
        status: 'paused',
        input: { value: 0 },
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
        },
      });

      expect(execute).toHaveBeenCalledTimes(1);
    });

    it('should timeTravel a workflow execution that has nested workflows', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const execute = vi.fn().mockResolvedValue({ step1Result: 2 });
      const executeStep2 = vi.fn().mockResolvedValue({ step2Result: 3 });
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
        input: { value: 0 },
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
        input: {},
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
        input: {},
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
          suspendPayload: { testPayload: 'hello' },
          suspendedAt: expect.any(Number),
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
          suspendPayload: { testPayload: 'hello' },
          suspendedAt: expect.any(Number),
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
        input: { value: 0 },
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
            metadata: { iterationCount: 5 },
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
        options: { validateInputs: false },
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
        input: {},
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
        input: { input: 'start' },
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
        input: {},
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

    it('should timeTravel workflow execution for workflow with parallel steps and run just the timeTravelled step when perStep is true', async ctx => {
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
        options: { validateInputs: false },
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
        server: {
          apiRoutes: [
            {
              path: '/inngest/api',
              method: 'ALL',
              createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
            },
          ],
        },
        workflows: { 'test-parallel-workflow': testParallelWorkflow },
      });
      const app = await createHonoServer(mastra);

      const srv = (globServer = serve({
        fetch: app.fetch,
        port: (ctx as any).handlerPort,
      }));
      await resetInngest();

      const run = await testParallelWorkflow.createRun();
      const result = await run.timeTravel({
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
        perStep: true,
      });

      expect(result.status).toBe('paused');
      expect(result).toEqual({
        status: 'paused',
        input: { input: 'start' },
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
        },
      });

      expect(initialStepAction).toHaveBeenCalledTimes(0);
      expect(nextStepAction).toHaveBeenCalledTimes(0);
      expect(parallelStep1Action).toHaveBeenCalledTimes(0);
      expect(parallelStep2Action).toHaveBeenCalledTimes(1);
      expect(parallelStep3Action).toHaveBeenCalledTimes(0);
      expect(finalStepAction).toHaveBeenCalledTimes(0);

      const run2 = await testParallelWorkflow.createRun();
      const result2 = await run2.timeTravel({
        step: 'parallelStep2',
        inputData: {
          result: 'next step done',
        },
        perStep: true,
      });

      expect(result2.status).toBe('paused');
      expect(result2).toEqual({
        status: 'paused',
        input: {},
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
        },
      });

      srv.close();

      expect(initialStepAction).toHaveBeenCalledTimes(0);
      expect(nextStepAction).toHaveBeenCalledTimes(0);
      expect(parallelStep1Action).toHaveBeenCalledTimes(0);
      expect(parallelStep2Action).toHaveBeenCalledTimes(2);
      expect(parallelStep3Action).toHaveBeenCalledTimes(0);
      expect(finalStepAction).toHaveBeenCalledTimes(0);
    });

    it('should timeTravel to step in conditional chains', async ctx => {
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
      const step5Action = vi.fn().mockImplementation(() => {
        return Promise.resolve({ result: 'step5' });
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
      const step5 = createStep({
        id: 'step5',
        execute: step5Action,
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ step5Result: z.string() }),
      });
      const step4 = createStep({
        id: 'step4',
        execute: async ({ inputData }) => {
          return { result: inputData.result + inputData.step5Result };
        },
        inputSchema: z.object({ result: z.string(), step5Result: z.string().optional() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ result: z.string() }),
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
              return inputData.status === 'success';
            },
            step5,
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
            step: [step3, step2, step5],
            path: 'result',
          },
          step5Result: {
            step: step5,
            path: 'result',
          },
        })
        .then(step4)
        .commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        server: {
          apiRoutes: [
            {
              path: '/inngest/api',
              method: 'ALL',
              createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
            },
          ],
        },
        workflows: { 'test-workflow': workflow },
      });

      const app = await createHonoServer(mastra);

      const srv = (globServer = serve({
        fetch: app.fetch,
        port: (ctx as any).handlerPort,
      }));
      await resetInngest();

      const run = await workflow.createRun();
      const result = await run.timeTravel({
        step: 'step5',
        inputData: {
          status: 'success',
        },
      });

      expect(step1Action).not.toHaveBeenCalled();
      expect(step2Action).not.toHaveBeenCalled();
      expect(step3Action).not.toHaveBeenCalled();
      expect(step5Action).toHaveBeenCalled();
      expect(result.steps).toMatchObject({
        input: {},
        step1: { status: 'success', output: { status: 'success' } },
        step2: { status: 'success', output: {} },
        step5: { status: 'success', output: { result: 'step5' } },
        step4: { status: 'success', output: { result: 'step5step5' } },
      });

      srv.close();
    });

    it('should timeTravel to step in conditional chains and run just one step when perStep is true', async ctx => {
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
      const step5Action = vi.fn().mockImplementation(() => {
        return Promise.resolve({ result: 'step5' });
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
      const step5 = createStep({
        id: 'step5',
        execute: step5Action,
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ step5Result: z.string() }),
      });
      const step4 = createStep({
        id: 'step4',
        execute: async ({ inputData }) => {
          return { result: inputData.result + inputData.step5Result };
        },
        inputSchema: z.object({ result: z.string(), step5Result: z.string().optional() }),
        outputSchema: z.object({ result: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ status: z.string() }),
        outputSchema: z.object({ result: z.string() }),
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
              return inputData.status === 'success';
            },
            step5,
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
            step: [step3, step2, step5],
            path: 'result',
          },
          step5Result: {
            step: step5,
            path: 'result',
          },
        })
        .then(step4)
        .commit();

      const mastra = new Mastra({
        logger: false,
        storage: testStorage,
        server: {
          apiRoutes: [
            {
              path: '/inngest/api',
              method: 'ALL',
              createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
            },
          ],
        },
        workflows: { 'test-workflow': workflow },
      });

      const app = await createHonoServer(mastra);

      const srv = (globServer = serve({
        fetch: app.fetch,
        port: (ctx as any).handlerPort,
      }));
      await resetInngest();

      const run = await workflow.createRun();
      const result = await run.timeTravel({
        step: 'step5',
        inputData: {
          status: 'success',
        },
        perStep: true,
      });

      srv.close();

      expect(step1Action).not.toHaveBeenCalled();
      expect(step2Action).not.toHaveBeenCalled();
      expect(step3Action).not.toHaveBeenCalled();
      expect(step5Action).toHaveBeenCalled();
      expect(result.steps).toMatchObject({
        input: {},
        step1: { status: 'success', output: { status: 'success' } },
        step5: { status: 'success', output: { result: 'step5' } },
      });
      expect(result.status).toBe('paused');
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

      const execute = vi.fn().mockResolvedValue({ result: 'success' });
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
      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps['nested-workflow-a'].output).toMatchObject({
        finalValue: 26 + 1,
      });

      // @ts-expect-error - testing dynamic workflow result
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
          // @ts-expect-error - testing dynamic workflow result
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
      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps['nested-workflow-a'].output).toMatchObject({
        finalValue: 26 + 1,
      });

      // @ts-expect-error - testing dynamic workflow result
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
        // @ts-expect-error - testing dynamic workflow result
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

        // @ts-expect-error - testing dynamic workflow result
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

        // @ts-expect-error - testing dynamic workflow result
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

        // @ts-expect-error - testing dynamic workflow result
        expect(result.steps['last-step']).toMatchObject(undefined);

        const resumedResults = await run.resume({ step: [wfA, otherStep], resumeData: { newValue: 0 } });

        // @ts-expect-error - testing dynamic workflow result
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

        // @ts-expect-error - testing dynamic workflow result
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

      const passthroughExecute = vi.fn().mockImplementation(async ({ inputData }) => {
        return inputData;
      });

      const passthroughStep = createStep({
        id: 'passthrough',
        inputSchema: counterInputSchema,
        outputSchema: counterInputSchema,
        execute: passthroughExecute,
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

      expect(passthroughExecute).toHaveBeenCalledTimes(2);
      expect(result.steps['nested-workflow-c']).toMatchObject({
        status: 'suspended',
        suspendPayload: {
          __workflow_meta: {
            path: ['nested-workflow-b', 'nested-workflow-a', 'other'],
          },
        },
      });

      // @ts-expect-error - testing dynamic workflow result
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

      // @ts-expect-error - testing dynamic workflow result
      expect(resumedResults.steps['nested-workflow-c'].output).toMatchObject({
        finalValue: 26 + 1,
      });

      expect(start).toHaveBeenCalledTimes(1);
      expect(other).toHaveBeenCalledTimes(2);
      expect(final).toHaveBeenCalledTimes(1);
      expect(last).toHaveBeenCalledTimes(1);
      expect(passthroughExecute).toHaveBeenCalledTimes(2);
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
      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps['nested-workflow-a-clone'].output).toMatchObject({
        finalValue: 26 + 1,
      });

      // @ts-expect-error - testing dynamic workflow result
      expect(result.steps['nested-workflow-b'].output).toMatchObject({
        finalValue: 1,
      });

      expect(result.steps['last-step']).toMatchObject({
        output: { success: true },
        status: 'success',
      });
    });
  });

  // Testing requestContext persistence across Inngest memoization
  describe('Dependency Injection', () => {
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
      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
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
      const result = await run.start({ requestContext });

      srv.close();

      // @ts-expect-error - testing dynamic workflow result
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

      // @ts-expect-error - testing dynamic workflow result
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
        options: { validateInputs: false },
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

      const mastra = new Mastra({
        logger: false,
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: { incrementWorkflow },
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

      const run = await incrementWorkflow.createRun();
      const result = await run.start({ inputData: { value: 0 } });
      expect(result.status).toBe('suspended');

      const resumeResult = await run.resume({
        resumeData: { value: 21 },
        step: ['resume'],
      });

      srv.close();

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
        options: { validateInputs: false },
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

      const mastra = new Mastra({
        logger: false,
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: { incrementWorkflow },
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

      const run = await incrementWorkflow.createRun();
      const result = await run.start({ inputData: { value: 0 } });
      expect(result.status).toBe('suspended');

      const resumeResult = await run.resume({
        resumeData: { value: 21 },
        step: ['resume'],
      });

      srv.close();

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

      // @ts-expect-error - testing dynamic workflow result
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

    it('should handle basic sleep waiting flow', async ctx => {
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

      const step1Action = vi.fn().mockResolvedValue({ value: 1000 });
      const step2Action = vi.fn().mockResolvedValue({ value: 2000 });

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
        if (data.type === 'step-suspended') {
          expect(promptAgentAction).toHaveBeenCalledTimes(1);

          // make it async to show that execution is not blocked
          setTimeout(() => {
            const resumeData = { stepId: 'promptAgent', context: { userInput: 'test input for resumption' } };
            run.resume({ resumeData: resumeData as any, step: promptAgent });
          }, 1000);
          expect(evaluateToneAction).not.toHaveBeenCalledTimes(1);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
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
        expect(result.scores['mock-scorer-toxicity']).toBe(0.9);
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

    it('should emit step-result and step-finish events when step fails', async ctx => {
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
            // After JSON.parse(JSON.stringify(...)), Error becomes a plain object
            error: expect.objectContaining({
              message: expect.stringMatching(/Step input validation failed/),
              name: expect.any(String),
            }),
            endedAt: expect.any(Number),
            startedAt: expect.any(Number),
            payload: {
              result: 'success1',
            },
            status: 'failed',
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
      expect(executionResult.steps.step2.status).toBe('failed');
      expect(executionResult.steps.step2.error).toBeInstanceOf(Error);
      expect((executionResult.steps.step2.error as Error).message).toMatch(/Step input validation failed/);
      expect(executionResult.steps.step2.payload).toEqual({ result: 'success1' });
      expect(executionResult.steps.step2.startedAt).toEqual(expect.any(Number));
      expect(executionResult.steps.step2.endedAt).toEqual(expect.any(Number));
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

      const streamOutput = run.stream({ inputData: { input: 'test' } });

      for await (const _data of streamOutput.fullStream) {
      }
      const resumeData = { stepId: 'promptAgent', context: { userInput: 'test input for resumption' } };
      const resumeStreamOutput = run.resumeStream({ resumeData, step: promptAgent });

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
        model: new MockLanguageModelV2({
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Paris' },
                { type: 'text-start', id: '1' },
                {
                  type: 'finish',
                  id: '2',
                  finishReason: 'stop',
                  logprobs: undefined,
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
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
        model: new MockLanguageModelV2({
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'London' },
                { type: 'text-start', id: '1' },
                {
                  type: 'finish',
                  id: '2',
                  finishReason: 'stop',
                  logprobs: undefined,
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
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

      // @ts-expect-error - testing dynamic workflow result
      expect(agentEvents.map(event => event?.payload?.output?.type)).toEqual([
        'start',
        'step-start',
        'text-start',
        'text-delta',
        'text-start',
        'step-finish',
        'finish',
        'start',
        'step-start',
        'text-start',
        'text-delta',
        'text-start',
        'step-finish',
        'finish',
      ]);

      expect(values).toMatchObject([
        {
          type: 'workflow-start',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {},
        },
        {
          type: 'workflow-step-start',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'start',
            id: 'start',
            payload: {
              prompt1: 'Capital of France, just the name',
              prompt2: 'Capital of UK, just the name',
            },
            startedAt: expect.any(Number),
            status: 'running',
          },
        },
        {
          type: 'workflow-step-result',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'start',
            id: 'start',
            status: 'success',
            output: {
              prompt1: 'Capital of France, just the name',
              prompt2: 'Capital of UK, just the name',
            },
            endedAt: expect.any(Number),
          },
        },
        {
          type: 'workflow-step-start',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: expect.any(String),
            id: expect.any(String),
            payload: {
              prompt1: 'Capital of France, just the name',
              prompt2: 'Capital of UK, just the name',
            },
            startedAt: expect.any(Number),
            status: 'running',
          },
        },
        {
          type: 'workflow-step-result',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: expect.any(String),
            id: expect.any(String),
            status: 'success',
            output: {
              prompt: 'Capital of France, just the name',
            },
            endedAt: expect.any(Number),
          },
        },
        {
          type: 'workflow-step-start',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'test-agent-1',
            id: 'test-agent-1',
            payload: {
              prompt: 'Capital of France, just the name',
            },
            startedAt: expect.any(Number),
            status: 'running',
          },
        },
        {
          type: 'workflow-step-result',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'test-agent-1',
            id: 'test-agent-1',
            status: 'success',
            output: {},
            endedAt: expect.any(Number),
          },
        },
        {
          type: 'workflow-step-start',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: expect.any(String),
            id: expect.any(String),
            payload: {},
            startedAt: expect.any(Number),
            status: 'running',
          },
        },
        {
          type: 'workflow-step-result',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: expect.any(String),
            id: expect.any(String),
            status: 'success',
            output: {
              prompt: 'Capital of UK, just the name',
            },
            endedAt: expect.any(Number),
          },
        },
        {
          type: 'workflow-step-start',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'test-agent-2',
            id: 'test-agent-2',
            payload: {
              prompt: 'Capital of UK, just the name',
            },
            startedAt: expect.any(Number),
            status: 'running',
          },
        },
        {
          type: 'workflow-step-result',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            stepName: 'test-agent-2',
            id: 'test-agent-2',
            status: 'success',
            output: {},
            endedAt: expect.any(Number),
          },
        },
        {
          type: 'workflow-finish',
          runId: 'test-run-id',
          from: 'WORKFLOW',
          payload: {
            output: {
              usage: {
                inputTokens: 20,
                outputTokens: 40,
                totalTokens: 60,
              },
            },
            metadata: {},
          },
        },
      ]);
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
        expect(result.scores['mock-scorer-toxicity']).toBe(0.9);
        expect(result.summary.totalItems).toBe(2);
      });
    });
  });

  describe.sequential('Long Running Steps', () => {
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
      const step1Action = vi.fn().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn().mockResolvedValue({ result: 'success2' });

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
      const step1Action = vi.fn().mockResolvedValue({ result: 'success1' });
      const step2Action = vi.fn().mockResolvedValue({ result: 'success2' });

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

      const workflowRun = await workflow.getWorkflowRunById(run1.runId);
      expect(workflowRun?.runId).toBe(run1.runId);
      expect(workflowRun?.workflowName).toBe('test-workflow');
      // getWorkflowRunById now returns WorkflowState with processed execution state
      expect(workflowRun?.status).toBe('success');
      expect(workflowRun?.steps).toBeDefined();
      srv.close();
    });
  });

  describe('Agent step with structured output schema', () => {
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

  describe.sequential('startAsync', () => {
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
  describe.sequential('onFinish and onError callbacks', () => {
    it('should call onFinish callback when workflow completes successfully', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const onFinishResults: any[] = [];
      const onErrorResults: any[] = [];

      const step1 = createStep({
        id: 'step1',
        execute: async () => {
          return { value: 42 };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.number() }),
      });

      const workflow = createWorkflow({
        id: 'test-onFinish-success-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.number() }),
        steps: [step1],
        retryConfig: { attempts: 0 },
        options: {
          onFinish: result => {
            onFinishResults.push(result);
          },
          onError: errorInfo => {
            onErrorResults.push(errorInfo);
          },
        },
      });
      workflow.then(step1).commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-onFinish-success-workflow': workflow,
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

      expect(result.status).toBe('success');
      expect(onFinishResults.length).toBe(1);
      expect(onFinishResults[0].status).toBe('success');
      expect(onErrorResults.length).toBe(0);

      srv.close();
    });

    it('should call onFinish and onError callbacks when workflow fails', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const onFinishResults: any[] = [];
      const onErrorResults: any[] = [];

      const failingStep = createStep({
        id: 'failing-step',
        execute: async () => {
          throw new Error('Intentional failure');
        },
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.number() }),
      });

      const workflow = createWorkflow({
        id: 'test-onError-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.number() }),
        steps: [failingStep],
        retryConfig: { attempts: 0 },
        options: {
          onFinish: result => {
            onFinishResults.push(result);
          },
          onError: errorInfo => {
            onErrorResults.push(errorInfo);
          },
        },
      });
      workflow.then(failingStep).commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-onError-workflow': workflow,
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

      expect(result.status).toBe('failed');
      expect(onFinishResults.length).toBe(1);
      expect(onFinishResults[0].status).toBe('failed');
      expect(onErrorResults.length).toBe(1);
      expect(onErrorResults[0].status).toBe('failed');

      srv.close();
    });

    it('should not call onError when workflow succeeds', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const onErrorResults: any[] = [];

      const step1 = createStep({
        id: 'step1',
        execute: async () => {
          return { value: 'success' };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-no-onError-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
        steps: [step1],
        retryConfig: { attempts: 0 },
        options: {
          onError: errorInfo => {
            onErrorResults.push(errorInfo);
          },
        },
      });
      workflow.then(step1).commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-no-onError-workflow': workflow,
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

      expect(result.status).toBe('success');
      expect(onErrorResults.length).toBe(0);

      srv.close();
    });

    it('should support async onFinish callback', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const onFinishResults: any[] = [];

      const step1 = createStep({
        id: 'step1',
        execute: async () => {
          return { value: 'done' };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-async-onFinish-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
        steps: [step1],
        retryConfig: { attempts: 0 },
        options: {
          onFinish: async result => {
            await new Promise(resolve => setTimeout(resolve, 10));
            onFinishResults.push(result);
          },
        },
      });
      workflow.then(step1).commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-async-onFinish-workflow': workflow,
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

      expect(result.status).toBe('success');
      expect(onFinishResults.length).toBe(1);
      expect(onFinishResults[0].status).toBe('success');

      srv.close();
    });

    it('should swallow callback errors and not fail the workflow', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const step1 = createStep({
        id: 'step1',
        execute: async () => {
          return { value: 'success' };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
      });

      const workflow = createWorkflow({
        id: 'test-callback-error-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.string() }),
        steps: [step1],
        retryConfig: { attempts: 0 },
        options: {
          onFinish: () => {
            throw new Error('Callback error should be swallowed');
          },
        },
      });
      workflow.then(step1).commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-callback-error-workflow': workflow,
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

      // Workflow should still succeed even though callback threw
      expect(result.status).toBe('success');

      srv.close();
    });

    it('should provide all expected properties in onFinish callback', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const onFinishResults: any[] = [];

      const step1 = createStep({
        id: 'step1',
        execute: async () => {
          return { value: 42 };
        },
        inputSchema: z.object({ inputValue: z.string() }),
        outputSchema: z.object({ value: z.number() }),
      });

      const workflow = createWorkflow({
        id: 'test-onFinish-properties-workflow',
        inputSchema: z.object({ inputValue: z.string() }),
        outputSchema: z.object({ value: z.number() }),
        steps: [step1],
        retryConfig: { attempts: 0 },
        options: {
          onFinish: result => {
            onFinishResults.push(result);
          },
        },
      });
      workflow.then(step1).commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-onFinish-properties-workflow': workflow,
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

      expect(result.status).toBe('success');
      expect(onFinishResults.length).toBe(1);

      const callbackResult = onFinishResults[0];

      // Verify new properties are present
      expect(callbackResult.runId).toBeDefined();
      expect(typeof callbackResult.runId).toBe('string');

      expect(callbackResult.workflowId).toBe('test-onFinish-properties-workflow');

      expect(callbackResult.getInitData).toBeDefined();
      expect(typeof callbackResult.getInitData).toBe('function');
      expect(callbackResult.getInitData()).toEqual({ inputValue: 'test-input' });

      expect(callbackResult.mastra).toBeDefined();

      expect(callbackResult.requestContext).toBeDefined();

      expect(callbackResult.logger).toBeDefined();

      expect(callbackResult.state).toBeDefined();
      expect(typeof callbackResult.state).toBe('object');

      srv.close();
    });

    it('should provide all expected properties in onError callback', async ctx => {
      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
      });

      const { createWorkflow, createStep } = init(inngest);

      const onErrorResults: any[] = [];

      const failingStep = createStep({
        id: 'failing-step',
        execute: async () => {
          throw new Error('Intentional failure for property test');
        },
        inputSchema: z.object({ inputValue: z.string() }),
        outputSchema: z.object({ value: z.number() }),
      });

      const workflow = createWorkflow({
        id: 'test-onError-properties-workflow',
        inputSchema: z.object({ inputValue: z.string() }),
        outputSchema: z.object({ value: z.number() }),
        steps: [failingStep],
        retryConfig: { attempts: 0 },
        options: {
          onError: errorInfo => {
            onErrorResults.push(errorInfo);
          },
        },
      });
      workflow.then(failingStep).commit();

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        workflows: {
          'test-onError-properties-workflow': workflow,
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

      expect(result.status).toBe('failed');
      expect(onErrorResults.length).toBe(1);

      const callbackResult = onErrorResults[0];

      // Verify new properties are present
      expect(callbackResult.runId).toBeDefined();
      expect(typeof callbackResult.runId).toBe('string');

      expect(callbackResult.workflowId).toBe('test-onError-properties-workflow');

      expect(callbackResult.getInitData).toBeDefined();
      expect(typeof callbackResult.getInitData).toBe('function');
      expect(callbackResult.getInitData()).toEqual({ inputValue: 'test-input' });

      expect(callbackResult.mastra).toBeDefined();

      expect(callbackResult.requestContext).toBeDefined();

      expect(callbackResult.logger).toBeDefined();

      expect(callbackResult.state).toBeDefined();
      expect(typeof callbackResult.state).toBe('object');

      srv.close();
    });
  });

  describe.sequential('Workflow Tracing', () => {
    it('should provide tracingContext.currentSpan to step execution', async ctx => {
      // This test verifies that workflow tracing works correctly.
      // The InngestWorkflow creates a workflow span and passes it to the execution engine,
      // which then makes it available to step handlers via tracingContext.currentSpan.

      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      let capturedTracingContext: any = null;

      const tracingStep = createStep({
        id: 'tracing-test-step',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: async ({ inputData, tracingContext }) => {
          // Capture the tracingContext for verification
          capturedTracingContext = tracingContext;
          return { result: `processed: ${inputData.value}` };
        },
      });

      const workflow = createWorkflow({
        id: 'tracing-test-workflow',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        steps: [tracingStep],
      });

      workflow.then(tracingStep).commit();

      // Create a simple test exporter to capture tracing events
      const capturedEvents: TracingEvent[] = [];
      const testExporter: ObservabilityExporter = {
        name: 'test-exporter',
        async exportTracingEvent(event: TracingEvent) {
          capturedEvents.push(event);
        },
        async shutdown() {},
      };

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        observability: new Observability({
          configs: {
            default: {
              serviceName: 'tracing-test',
              exporters: [testExporter],
            },
          },
        }),
        workflows: {
          'tracing-test-workflow': workflow,
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
      const result = await run.start({ inputData: { value: 'test' } });

      srv.close();

      // Verify workflow execution succeeded
      expect(result.status).toBe('success');
      expect(result.steps['tracing-test-step']).toMatchObject({
        status: 'success',
        output: { result: 'processed: test' },
      });

      // Verify tracing context was provided
      expect(capturedTracingContext).toBeDefined();

      expect(capturedTracingContext.currentSpan).toBeDefined();
    });

    it('should create workflow step child spans from the workflow span', async ctx => {
      // This test verifies that step spans can be created as children of the workflow span.
      // The step handler in packages/core/src/workflows/handlers/step.ts line 138 does:
      //   const stepSpan = tracingContext.currentSpan?.createChildSpan({...})
      // When currentSpan is undefined (as it is in Inngest), stepSpan will be undefined.

      const inngest = new Inngest({
        id: 'mastra',
        baseUrl: `http://localhost:${(ctx as any).inngestPort}`,
        middleware: [realtimeMiddleware()],
      });

      const { createWorkflow, createStep } = init(inngest);

      let stepSpanExists = false;

      const spanTestStep = createStep({
        id: 'span-test-step',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: async ({ inputData, tracingContext }) => {
          // Check if we can create a child span (which requires currentSpan to exist)
          stepSpanExists = tracingContext?.currentSpan !== undefined;
          return { result: `processed: ${inputData.value}` };
        },
      });

      const workflow = createWorkflow({
        id: 'span-test-workflow',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        steps: [spanTestStep],
      });

      workflow.then(spanTestStep).commit();

      // Create a simple test exporter
      const testExporter2: ObservabilityExporter = {
        name: 'test-exporter-2',
        async exportTracingEvent() {},
        async shutdown() {},
      };

      const mastra = new Mastra({
        storage: new DefaultStorage({
          id: 'test-storage',
          url: ':memory:',
        }),
        observability: new Observability({
          configs: {
            default: {
              serviceName: 'span-test',
              exporters: [testExporter2],
            },
          },
        }),
        workflows: {
          'span-test-workflow': workflow,
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
      const result = await run.start({ inputData: { value: 'test' } });

      srv.close();

      expect(result.status).toBe('success');

      // This should be true if tracing is working correctly
      expect(stepSpanExists).toBe(true);
    });
  });
}, 80e3);

// ============================================================================
// Shared Test Suite (Inngest Engine)
// ============================================================================

// Shared infrastructure - created once for all shared suite tests
let sharedInngest: Inngest;
let sharedMastra: Mastra;
let sharedServer: ServerType;
let sharedStorage: DefaultStorage;
let sharedInngestProcess: ResultPromise | null = null;

const SHARED_INNGEST_PORT = 4000;
const SHARED_HANDLER_PORT = 4001;

/**
 * Wait for handler to be responding to requests
 */
async function waitForSharedHandler(maxAttempts = 30, intervalMs = 100): Promise<boolean> {
  const handlerUrl = `http://localhost:${SHARED_HANDLER_PORT}/inngest/api`;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(handlerUrl, { method: 'GET' });
      // The handler returns 200 on GET with function info
      if (response.ok || response.status === 405) {
        console.log(`[waitForSharedHandler] Handler ready after ${i + 1} attempts`);
        return true;
      }
    } catch {
      // Connection refused, keep trying
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  console.log('[waitForSharedHandler] Handler not ready after max attempts');
  return false;
}

/**
 * Ensure the Inngest dev server is running and has registered our functions.
 *
 * Uses the npm-installed inngest-cli binary (no Docker required).
 * The dev server polls the handler URL for function definitions.
 */
async function startSharedInngest() {
  // First, verify the handler is responding
  console.log('[startSharedInngest] Verifying handler is responding...');
  const handlerReady = await waitForSharedHandler();
  if (!handlerReady) {
    throw new Error('Handler not responding on port ' + SHARED_HANDLER_PORT);
  }

  // Check if Inngest is already running
  try {
    const response = await fetch(`http://localhost:${SHARED_INNGEST_PORT}/dev`);
    if (response.ok) {
      const data = await response.json();
      const functionsRegistered = data.functions?.length || 0;
      console.log(`[startSharedInngest] Inngest already running with ${functionsRegistered} functions`);
      if (functionsRegistered > 0) return;
    }
  } catch {
    // Not running yet
  }

  // Start the inngest dev server as a background process using the npm CLI
  console.log('[startSharedInngest] Starting Inngest dev server via inngest-cli...');
  sharedInngestProcess = execaCommand(
    `npx inngest-cli dev -p ${SHARED_INNGEST_PORT} -u http://localhost:${SHARED_HANDLER_PORT}/inngest/api --poll-interval=1 --retry-interval=1`,
    { cwd: import.meta.dirname, stdio: 'ignore', reject: false },
  );

  // Wait for the dev server to be ready
  console.log('[startSharedInngest] Waiting for Inngest dev server to be ready...');
  for (let i = 0; i < 30; i++) {
    try {
      const response = await fetch(`http://localhost:${SHARED_INNGEST_PORT}/dev`);
      if (response.ok) {
        console.log(`[startSharedInngest] Inngest dev server ready after ${i + 1} attempts`);
        break;
      }
    } catch {
      // Keep trying
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Trigger registration by sending PUT to the handler
  // This makes the handler send its function definitions to the dev server
  console.log('[startSharedInngest] Triggering function registration via PUT...');
  try {
    await fetch(`http://localhost:${SHARED_HANDLER_PORT}/inngest/api`, { method: 'PUT' });
  } catch (e) {
    console.log('[startSharedInngest] PUT registration failed:', e);
  }

  // Wait for function registration
  console.log('[startSharedInngest] Waiting for function registration...');
  for (let i = 0; i < 30; i++) {
    try {
      const response = await fetch(`http://localhost:${SHARED_INNGEST_PORT}/dev`);
      const data = await response.json();
      const functionsRegistered = data.functions?.length || 0;
      if (functionsRegistered > 0) {
        console.log(`[startSharedInngest] ${functionsRegistered} functions registered`);
        return;
      }
    } catch {
      // Keep trying
    }
    if (i === 10) {
      // Retry PUT registration if not yet registered
      console.log('[startSharedInngest] Retrying PUT registration...');
      try {
        await fetch(`http://localhost:${SHARED_HANDLER_PORT}/inngest/api`, { method: 'PUT' });
      } catch {
        // Ignore
      }
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error('[startSharedInngest] No functions registered after 30 attempts - aborting test suite');
}

/**
 * Stop the Inngest dev server
 */
async function stopSharedInngest() {
  if (sharedInngestProcess) {
    sharedInngestProcess.kill();
    sharedInngestProcess = null;
  }
}

createWorkflowTestSuite({
  name: 'Workflow (Inngest Engine)',

  getWorkflowFactory: () => {
    // Create Inngest client if not already created
    if (!sharedInngest) {
      sharedInngest = new Inngest({
        id: 'mastra-workflow-tests',
        baseUrl: `http://localhost:${SHARED_INNGEST_PORT}`,
        middleware: [realtimeMiddleware()],
      });
    }
    return init(sharedInngest);
  },

  /**
   * Register all workflows with Mastra and start the server.
   * This is called once after all workflows are created.
   *
   * Order of operations:
   * 1. Start the handler server (so Inngest can sync with it)
   * 2. Start Inngest (which will auto-discover and sync with handler)
   * 3. Wait for sync to complete
   */
  registerWorkflows: async (registry: WorkflowRegistry) => {
    // Collect all workflows from registry
    const workflows: Record<string, InngestWorkflow<any, any, any, any, any, any, any>> = {};
    for (const [id, entry] of Object.entries(registry)) {
      workflows[id] = entry.workflow as InngestWorkflow<any, any, any, any, any, any, any>;
    }

    // Create storage
    sharedStorage = new DefaultStorage({
      id: 'shared-test-storage',
      url: ':memory:',
    });

    // Create Mastra with all workflows
    sharedMastra = new Mastra({
      storage: sharedStorage,
      workflows,
      server: {
        apiRoutes: [
          {
            path: '/inngest/api',
            method: 'ALL',
            createHandler: async ({ mastra }) => inngestServe({ mastra, inngest: sharedInngest }),
          },
        ],
      },
    });

    // Start handler server FIRST (before Inngest)
    console.log('[registerWorkflows] Starting handler server...');

    // Debug: check what workflows are registered with Mastra
    const registeredWorkflows = sharedMastra.listWorkflows();
    console.log(
      `[registerWorkflows] Mastra has ${Object.keys(registeredWorkflows).length} workflows registered:`,
      Object.keys(registeredWorkflows),
    );

    const app = await createHonoServer(sharedMastra);
    sharedServer = serve({
      fetch: app.fetch,
      port: SHARED_HANDLER_PORT,
    });
    console.log(`[registerWorkflows] Handler server started on port ${SHARED_HANDLER_PORT}`);

    // Wait for handler to be fully ready before starting Inngest
    await new Promise(resolve => setTimeout(resolve, 500));

    // Now start Inngest (this also triggers registration via PUT with url body)
    console.log('[registerWorkflows] Starting Inngest...');
    await startSharedInngest();
    console.log('[registerWorkflows] Inngest started and functions registered');
  },

  // Provide access to storage for tests that need to spy on storage operations
  getStorage: () => sharedStorage,

  // beforeAll is called AFTER registerWorkflows in the factory, so nothing to do here
  beforeAll: async () => {
    console.log('[beforeAll] Ready');
  },

  afterAll: async () => {
    // Close server
    if (sharedServer) {
      await new Promise<void>(resolve => sharedServer.close(() => resolve()));
    }
    await stopSharedInngest();
  },

  beforeEach: async () => {
    // Reset all mock call counts to prevent accumulation across tests
    vi.clearAllMocks();

    // Wait for Inngest to settle between tests (reduced from 2000ms)
    await new Promise(resolve => setTimeout(resolve, 500));
  },

  // ============================================================================
  // Domain-level skips: These domains require different APIs or aren't implemented
  // Individual test skips within enabled domains are configured in skipTests below
  // ============================================================================
  skip: {
    // ENABLED DOMAINS - these work with Inngest (individual tests may be skipped)
    variableResolution: false,
    simpleConditions: false,
    errorHandling: false,
    loops: false,
    foreach: false,
    branching: false,
    retry: false,
    callbacks: false,
    streaming: false,
    workflowRuns: false,
    dependencyInjection: false,
    nestedWorkflows: false,
    multipleChains: false,
    complexConditions: false,

    // ENABLED DOMAINS - individual tests may be skipped via skipTests below
    schemaValidation: false,
    suspendResume: false,
    timeTravel: false,
    agentStep: false,
    abort: false,
    interoperability: false,

    // SKIPPED DOMAINS - not supported on Inngest engine
    restart: true, // restart() throws "not supported on inngest workflows"
  },

  skipTests: {
    // ============================================================================
    // FIXED BY SNAPSHOT PERSISTENCE: These tests now pass after adding explicit
    // snapshot persistence before workflow-finish in workflow.ts finalize step.
    // ============================================================================
    state: false,
    variableResolutionErrors: false,
    foreachSingleConcurrency: true, // Flaky - race condition with snapshot persistence
    callbackOnFinish: false,
    callbackOnError: false,

    // ============================================================================
    // TIMING: Inngest network overhead (100-500ms/step) makes timing unreliable
    // ============================================================================
    foreachConcurrentTiming: true, // Expected <2000ms, got ~6000ms
    foreachPartialConcurrencyTiming: true, // Expected <1500ms, got ~7000ms

    // ============================================================================
    // BEHAVIOR DIFFERENCES: Inngest handles these differently than default engine
    // ============================================================================
    schemaValidationThrows: true, // Inngest doesn't throw - validation happens async, returns result
    abortStatus: true, // Inngest returns 'failed' or 'success', no 'canceled' status
    streamingSuspendResumeLegacy: true, // Inngest streaming has different suspend/resume behavior
    abortDuringStep: true, // Abort during step test has 5s timeout waiting for abort signal
    agentStepDeepNested: true, // Deep nested agent workflow fails on Inngest
    executionFlowNotDefined: true, // InngestWorkflow.createRun() doesn't validate stepFlow
    executionGraphNotCommitted: true, // InngestWorkflow.createRun() doesn't validate commit status
    resumeMultiSuspendError: true, // Inngest result doesn't include 'suspended' array
    resumeForeach: true, // Foreach suspend/resume uses different step coordination
    resumeForeachConcurrent: true, // Foreach concurrent resume returns 'failed' not 'suspended'
    resumeForeachIndex: true, // forEachIndex parameter not fully supported
    storageWithNestedWorkflows: true, // Inngest step.invoke() uses different step naming convention

    // ============================================================================
    // ALL PASSING TESTS
    // ============================================================================
    loopUntil: false,
    loopWhile: false,
    errorIdentity: false,
    emptyForeach: false,
    nestedMultipleLevels: false,
    mapPreviousStep: false,
    nestedWorkflowFailure: false,
    nestedDataPassing: false,
    callbackResult: false,
    callbackOnErrorNotCalled: false,
    callbackBothOnFailure: false,
    callbackAsyncOnFinish: false,
    callbackAsyncOnError: false,
    nestedWorkflowErrors: false,
    parallelBranchErrors: false,
    errorMessageFormat: false,
    branchingElse: false,
    stepExecutionOrder: false,
    nonObjectOutput: false,
    requestContextPropagation: false,
    getInitData: false,
    errorCauseChain: false,
    // Storage round-trip test - enabled since storage tests pass
    errorStorageRoundtrip: false,
    // Error persistence tests - enabled with storage spy access
    errorPersistWithoutStack: false,
    errorPersistMastraError: false,
    // Resume tests - enabled for testing
    resumeBasic: false,
    resumeWithLabel: false, // Testing - uses label instead of step
    resumeWithState: true, // requestContext bug #4442 - request context not preserved during resume
    resumeNested: true, // Nested step path resume not supported on Inngest
    resumeParallelMulti: true, // parallel suspended steps behavior differs on Inngest
    resumeAutoDetect: true, // Inngest result doesn't include 'suspended' array property
    resumeBranchingStatus: true, // Inngest branching + suspend behavior differs (returns 'failed' not 'suspended')
    resumeConsecutiveNested: true, // Nested step path resume not supported on Inngest
    resumeDountil: true, // Dountil loop with nested resume not supported on Inngest
    resumeLoopInput: true, // Loop resume input tracking not supported on Inngest
    resumeMapStep: true, // Map step resume not supported on Inngest
    // Foreach: state batch and bail not supported on Inngest
    foreachStateBatch: true, // stateSchema batching not supported
    foreachBail: true, // bail() in foreach not supported
    // DI: requestContext not preserved across suspend/resume on Inngest
    diResumeRequestContext: true, // requestContext lost during Inngest resume
    diRequestContextBeforeSuspension: true, // requestContext values lost after resume
    diBug4442: true, // requestContext bug #4442 - same issue
    // Resume: additional foreach/parallel resume not supported on Inngest
    resumeAutoNoStep: true, // Auto-resume without step parameter not supported
    resumeForeachPartialIndex: true, // Foreach partial index resume not supported
    resumeForeachLabel: true, // Foreach label resume not supported
    resumeForeachPartial: true, // Foreach partial resume not supported
    resumeNotSuspendedWorkflow: true, // Error for non-suspended workflow differs
    // Storage tests - enabled for testing
    storageListRuns: false,
    storageGetDelete: false,
    storageResourceId: false,
    // Run count tests - skip until loop behavior is verified
    runCount: true,
    retryCount: true,
  },

  executeWorkflow: async (workflow, inputData, options = {}): Promise<WorkflowResult> => {
    const inngestWorkflow = workflow as unknown as InngestWorkflow<any, any, any, any, any, any, any>;

    // Create the run and execute
    // The workflow is already registered with Mastra, so we can execute directly
    const run = await inngestWorkflow.createRun({
      runId: options.runId,
      resourceId: options.resourceId,
    });
    const result = await run.start({
      inputData,
      initialState: options.initialState,
      perStep: options.perStep,
      requestContext: options.requestContext as any,
    });

    return result as WorkflowResult;
  },

  resumeWorkflow: async (workflow, options: ResumeWorkflowOptions): Promise<WorkflowResult> => {
    const inngestWorkflow = workflow as unknown as InngestWorkflow<any, any, any, any, any, any, any>;

    // Create the run with the existing runId to resume
    const run = await inngestWorkflow.createRun({ runId: options.runId });
    const result = await run.resume({
      step: options.step,
      label: options.label,
      resumeData: options.resumeData,
    } as any);

    return result as WorkflowResult;
  },
});
