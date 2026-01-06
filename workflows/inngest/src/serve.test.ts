import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import { Inngest } from 'inngest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { z } from 'zod';

import { init, serve, serveExpress, serveFastify, serveHono } from './index';

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

describe('Multi-framework serve exports', () => {
  describe('Export availability', () => {
    it('should export serve (default/Hono for backwards compatibility)', () => {
      expect(typeof serve).toBe('function');
    });

    it('should export serveHono', () => {
      expect(typeof serveHono).toBe('function');
    });

    it('should export serveExpress', () => {
      expect(typeof serveExpress).toBe('function');
    });

    it('should export serveFastify', () => {
      expect(typeof serveFastify).toBe('function');
    });
  });

  describe('Serve function behavior', () => {
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

    it('should call inngest/hono serve with correct options when using serve()', async () => {
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

    it('should call inngest/hono serve with correct options when using serveHono()', async () => {
      const { serve: honoServe } = await import('inngest/hono');

      serveHono({ mastra, inngest });

      expect(honoServe).toHaveBeenCalledWith(
        expect.objectContaining({
          client: inngest,
          functions: expect.any(Array),
        }),
      );
    });

    it('should call inngest/express serve with correct options when using serveExpress()', async () => {
      const { serve: expressServe } = await import('inngest/express');

      serveExpress({ mastra, inngest });

      expect(expressServe).toHaveBeenCalledWith(
        expect.objectContaining({
          client: inngest,
          functions: expect.any(Array),
        }),
      );

      // Verify workflow functions were collected
      const callArgs = vi.mocked(expressServe).mock.calls[0][0];
      expect(callArgs.functions.length).toBeGreaterThan(0);
    });

    it('should call inngest/fastify serve with correct options when using serveFastify()', async () => {
      const { serve: fastifyServe } = await import('inngest/fastify');

      serveFastify({ mastra, inngest });

      expect(fastifyServe).toHaveBeenCalledWith(
        expect.objectContaining({
          client: inngest,
          functions: expect.any(Array),
        }),
      );

      // Verify workflow functions were collected
      const callArgs = vi.mocked(fastifyServe).mock.calls[0][0];
      expect(callArgs.functions.length).toBeGreaterThan(0);
    });

    it('should pass additional user functions to all serve variants', async () => {
      const { serve: honoServe } = await import('inngest/hono');
      const { serve: expressServe } = await import('inngest/express');
      const { serve: fastifyServe } = await import('inngest/fastify');

      const userFunction = inngest.createFunction({ id: 'user-function' }, { event: 'test/event' }, async () => 'done');

      serveHono({ mastra, inngest, functions: [userFunction] });
      serveExpress({ mastra, inngest, functions: [userFunction] });
      serveFastify({ mastra, inngest, functions: [userFunction] });

      // All should include user functions
      for (const mockServe of [honoServe, expressServe, fastifyServe]) {
        const callArgs = vi.mocked(mockServe).mock.calls[0][0];
        expect(callArgs.functions).toContain(userFunction);
      }
    });

    it('should pass registerOptions to all serve variants', async () => {
      const { serve: honoServe } = await import('inngest/hono');
      const { serve: expressServe } = await import('inngest/express');
      const { serve: fastifyServe } = await import('inngest/fastify');

      const registerOptions = { servePath: '/custom/inngest' };

      serveHono({ mastra, inngest, registerOptions });
      serveExpress({ mastra, inngest, registerOptions });
      serveFastify({ mastra, inngest, registerOptions });

      // All should include registerOptions
      for (const mockServe of [honoServe, expressServe, fastifyServe]) {
        const callArgs = vi.mocked(mockServe).mock.calls[0][0];
        expect(callArgs.servePath).toBe('/custom/inngest');
      }
    });

    it('should collect workflow functions consistently across all serve variants', async () => {
      const { serve: honoServe } = await import('inngest/hono');
      const { serve: expressServe } = await import('inngest/express');
      const { serve: fastifyServe } = await import('inngest/fastify');

      serveHono({ mastra, inngest });
      serveExpress({ mastra, inngest });
      serveFastify({ mastra, inngest });

      const honoFunctions = vi.mocked(honoServe).mock.calls[0][0].functions;
      const expressFunctions = vi.mocked(expressServe).mock.calls[0][0].functions;
      const fastifyFunctions = vi.mocked(fastifyServe).mock.calls[0][0].functions;

      // All should have collected the same workflow functions
      expect(honoFunctions.length).toBe(expressFunctions.length);
      expect(honoFunctions.length).toBe(fastifyFunctions.length);
    });
  });
});
