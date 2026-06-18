import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import { Inngest } from 'inngest';
import { describe, expect, it, vi, beforeEach, afterAll } from 'vitest';
import { z } from 'zod';

import { init, serve, createServe, connect } from './index';

// Mock the inngest framework-specific serve functions using vi.hoisted to ensure
// mocks are created before module imports capture the real functions
const mocks = vi.hoisted(() => {
  return {
    honoServe: vi.fn(() => () => Promise.resolve(new Response())),
    expressServe: vi.fn(() => () => {}),
    fastifyServe: vi.fn(() => () => Promise.resolve()),
    inngestConnect: vi.fn(async () => ({
      connectionId: 'conn-test',
      close: vi.fn(async () => {}),
      closed: Promise.resolve(),
      state: 'ACTIVE',
      getDebugState: vi.fn(),
    })),
  };
});

vi.mock('inngest/hono', () => ({ serve: mocks.honoServe }));
vi.mock('inngest/express', () => ({ serve: mocks.expressServe }));
vi.mock('inngest/fastify', () => ({ serve: mocks.fastifyServe }));
vi.mock('inngest/connect', () => ({ connect: mocks.inngestConnect }));

const { honoServe, expressServe: _expressServe, fastifyServe: _fastifyServe, inngestConnect } = mocks;

const getFunctionIds = (functions: Array<{ id?: (prefix?: string) => string }>) =>
  functions.map(fn => {
    if (typeof fn.id === 'function') return fn.id();
    throw new Error('Expected an Inngest function with an id() method');
  });

describe('Multi-framework serve', () => {
  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('Export availability', () => {
    it('should export serve (default Hono for backwards compatibility)', () => {
      expect(typeof serve).toBe('function');
    });

    it('should export createServe factory function', () => {
      expect(typeof createServe).toBe('function');
    });
  });

  describe('serve() default behavior', () => {
    let mastra: Mastra;
    let inngest: Inngest;

    beforeEach(async () => {
      vi.clearAllMocks();

      inngest = new Inngest({ id: 'test-app' });
      const { createWorkflow, createStep } = init(inngest);

      const step1 = createStep({
        id: 'step1',
        execute: async () => ({ result: 'done' }),
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

      mastra = new Mastra({
        storage: new MockStore(),
        workflows: {
          'test-workflow': workflow,
        },
      });
    });

    it('should call inngest/hono serve with correct options', async () => {
      serve({ mastra, inngest });

      expect(honoServe).toHaveBeenCalledWith(
        expect.objectContaining({
          client: inngest,
          functions: expect.any(Array),
        }),
      );

      // Verify workflow functions were collected
      const callArgs = honoServe.mock.calls[0][0];
      expect(callArgs.functions.length).toBeGreaterThan(0);
    });

    it('should pass additional user functions', async () => {
      const userFunction = inngest.createFunction(
        { id: 'user-function', triggers: { event: 'test/event' } },
        async () => 'done',
      );

      serve({ mastra, inngest, functions: [userFunction] });

      const callArgs = honoServe.mock.calls[0][0];
      expect(callArgs.functions).toContain(userFunction);
    });

    it('should pass registerOptions', async () => {
      const registerOptions = { servePath: '/custom/inngest' };

      serve({ mastra, inngest, registerOptions });

      const callArgs = honoServe.mock.calls[0][0];
      expect(callArgs.servePath).toBe('/custom/inngest');
    });

    it('should collect the same functions for serve and connect', async () => {
      const { createWorkflow, createStep } = init(inngest);

      const step = createStep({
        id: 'nested-step',
        execute: async () => ({ result: 'done' }),
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });

      const nestedWorkflow = createWorkflow({
        id: 'nested-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        steps: [step],
      });
      nestedWorkflow.then(step).commit();

      const parentWorkflow = createWorkflow({
        id: 'parent-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        steps: [nestedWorkflow],
      });
      parentWorkflow.then(nestedWorkflow).commit();

      const cronWorkflow = createWorkflow({
        id: 'cron-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        steps: [step],
        cron: '*/5 * * * *',
      });
      cronWorkflow.then(step).commit();

      const userFunction = inngest.createFunction(
        { id: 'user-function', triggers: { event: 'test/event' } },
        async () => 'done',
      );
      const equivalentMastra = new Mastra({
        storage: new MockStore(),
        workflows: {
          'parent-workflow': parentWorkflow,
          'cron-workflow': cronWorkflow,
        },
      });
      const adapter = vi.fn(options => options);

      const serveOptions = createServe(adapter)({ mastra: equivalentMastra, inngest, functions: [userFunction] });
      await connect({ mastra: equivalentMastra, inngest, functions: [userFunction] });

      const connectOptions = inngestConnect.mock.calls[0][0];
      expect(getFunctionIds(connectOptions.apps[0].functions)).toEqual(getFunctionIds(serveOptions.functions));
      expect(getFunctionIds(connectOptions.apps[0].functions)).toEqual([
        'workflow.parent-workflow',
        'workflow.nested-workflow',
        'workflow.cron-workflow',
        'workflow.cron-workflow.cron',
        'user-function',
      ]);
    });
  });

  describe('createServe() factory function', () => {
    let mastra: Mastra;
    let inngest: Inngest;

    beforeEach(async () => {
      vi.clearAllMocks();

      inngest = new Inngest({ id: 'test-app' });
      const { createWorkflow, createStep } = init(inngest);

      const step1 = createStep({
        id: 'step1',
        execute: async () => ({ result: 'done' }),
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

      mastra = new Mastra({
        storage: new MockStore(),
        workflows: {
          'test-workflow': workflow,
        },
      });
    });

    it('should work with a custom serve adapter', async () => {
      const customServe = vi.fn(() => () => 'custom-handler');

      const serveWithCustom = createServe(customServe);
      serveWithCustom({ mastra, inngest });

      expect(customServe).toHaveBeenCalledWith(
        expect.objectContaining({
          client: inngest,
          functions: expect.any(Array),
        }),
      );

      // Verify workflow functions were collected
      const callArgs = customServe.mock.calls[0][0];
      expect(callArgs.functions.length).toBeGreaterThan(0);
    });

    it('should pass user functions to custom adapter', async () => {
      const customServe = vi.fn(() => () => 'custom-handler');
      const userFunction = inngest.createFunction(
        { id: 'user-function', triggers: { event: 'test/event' } },
        async () => 'done',
      );

      const serveWithCustom = createServe(customServe);
      serveWithCustom({ mastra, inngest, functions: [userFunction] });

      const callArgs = customServe.mock.calls[0][0];
      expect(callArgs.functions).toContain(userFunction);
    });

    it('should pass registerOptions to custom adapter', async () => {
      const customServe = vi.fn(() => () => 'custom-handler');
      const registerOptions = { servePath: '/custom/path' };

      const serveWithCustom = createServe(customServe);
      serveWithCustom({ mastra, inngest, registerOptions });

      const callArgs = customServe.mock.calls[0][0];
      expect(callArgs.servePath).toBe('/custom/path');
    });

    it('should work with inngest/express adapter', async () => {
      const { serve: expressServe } = await import('inngest/express');

      const serveExpress = createServe(expressServe);
      serveExpress({ mastra, inngest });

      expect(expressServe).toHaveBeenCalledWith(
        expect.objectContaining({
          client: inngest,
          functions: expect.any(Array),
        }),
      );
    });

    it('should work with inngest/fastify adapter', async () => {
      const { serve: fastifyServe } = await import('inngest/fastify');

      const serveFastify = createServe(fastifyServe);
      serveFastify({ mastra, inngest });

      expect(fastifyServe).toHaveBeenCalledWith(
        expect.objectContaining({
          client: inngest,
          functions: expect.any(Array),
        }),
      );
    });
  });
});
