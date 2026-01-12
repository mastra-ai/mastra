import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import { Inngest } from 'inngest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { z } from 'zod';

import { init, serve, createServe } from './index';

// Mock the inngest framework-specific serve functions
vi.mock('inngest/hono', () => ({
  serve: vi.fn(() => () => Promise.resolve(new Response())),
}));

vi.mock('inngest/express', () => ({
  serve: vi.fn(() => () => {}),
}));

vi.mock('inngest/fastify', () => ({
  serve: vi.fn(() => () => Promise.resolve()),
}));

describe('Multi-framework serve', () => {
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
      const { serve: honoServe } = await import('inngest/hono');

      serve({ mastra, inngest });

      expect(honoServe).toHaveBeenCalledWith(
        expect.objectContaining({
          client: inngest,
          functions: expect.any(Array),
        }),
      );

      // Verify workflow functions were collected
      const callArgs = vi.mocked(honoServe).mock.calls[0][0];
      expect(callArgs.functions.length).toBeGreaterThan(0);
    });

    it('should pass additional user functions', async () => {
      const { serve: honoServe } = await import('inngest/hono');

      const userFunction = inngest.createFunction({ id: 'user-function' }, { event: 'test/event' }, async () => 'done');

      serve({ mastra, inngest, functions: [userFunction] });

      const callArgs = vi.mocked(honoServe).mock.calls[0][0];
      expect(callArgs.functions).toContain(userFunction);
    });

    it('should pass registerOptions', async () => {
      const { serve: honoServe } = await import('inngest/hono');

      const registerOptions = { servePath: '/custom/inngest' };

      serve({ mastra, inngest, registerOptions });

      const callArgs = vi.mocked(honoServe).mock.calls[0][0];
      expect(callArgs.servePath).toBe('/custom/inngest');
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
      const userFunction = inngest.createFunction({ id: 'user-function' }, { event: 'test/event' }, async () => 'done');

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
