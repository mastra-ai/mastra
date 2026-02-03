import { Mastra } from '@mastra/core/mastra';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { MastraServer } from '../index';

/**
 * These tests verify that MastraServer (Fastify adapter) properly supports
 * getApp() method inherited from MastraServerBase.
 *
 * These tests focus on verifying the adapter's getApp functionality
 * and demonstrate how users would access the Fastify app.
 */
describe('MastraServer (Fastify) - Server App Access', () => {
  describe('getApp()', () => {
    it('should have getApp method', () => {
      const mastra = new Mastra({ logger: false });
      const app = Fastify();
      const adapter = new MastraServer({ app, mastra });

      expect(typeof adapter.getApp).toBe('function');
    });

    it('should return the app passed to constructor', () => {
      const mastra = new Mastra({ logger: false });
      const app = Fastify();
      const adapter = new MastraServer({ app, mastra });

      const retrievedApp = adapter.getApp();
      expect(retrievedApp).toBe(app);
    });

    it('should support generic type parameter for getApp', () => {
      const mastra = new Mastra({ logger: false });
      const app = Fastify();
      const adapter = new MastraServer({ app, mastra });

      // Get with specific type
      const typedApp = adapter.getApp<FastifyInstance>();
      expect(typedApp).toBe(app);
      expect(typeof typedApp.get).toBe('function');
      expect(typeof typedApp.post).toBe('function');
      expect(typeof typedApp.listen).toBe('function');
    });
  });

  describe('Integration with Mastra instance', () => {
    it('should automatically register with Mastra in constructor', () => {
      const mastra = new Mastra({ logger: false });
      const app = Fastify();

      // Creating the adapter automatically registers it with Mastra
      new MastraServer({ app, mastra });

      // Access app via Mastra
      const appFromMastra = mastra.getServerApp<FastifyInstance>();
      expect(appFromMastra).toBe(app);
    });

    it('should return the same app from both adapter and mastra', () => {
      const mastra = new Mastra({ logger: false });
      const app = Fastify();
      const adapter = new MastraServer({ app, mastra });

      const appFromAdapter = adapter.getApp<FastifyInstance>();
      const appFromMastra = mastra.getServerApp<FastifyInstance>();
      const adapterFromMastra = mastra.getMastraServer();
      const appFromRetrievedAdapter = adapterFromMastra?.getApp<FastifyInstance>();

      expect(appFromAdapter).toBe(app);
      expect(appFromMastra).toBe(app);
      expect(appFromRetrievedAdapter).toBe(app);
    });
  });

  describe('Fastify app with HTTP server', () => {
    let app: FastifyInstance | null = null;

    afterEach(async () => {
      if (app) {
        await app.close();
        app = null;
      }
    });

    it('should allow starting a server and making requests using the stored app', async () => {
      const mastra = new Mastra({ logger: false });
      app = Fastify();

      // Add a test route
      app.get('/api/test', async () => {
        return { message: 'Hello from Fastify!' };
      });

      // Wire up the adapter - automatically registers with mastra
      new MastraServer({ app, mastra });

      // Get the app via mastra.getServerApp() and start a server
      const fastifyApp = mastra.getServerApp<FastifyInstance>();
      expect(fastifyApp).toBeDefined();

      // Start server on random port
      const address = await fastifyApp!.listen({ port: 0 });

      // Make a request to the server
      const response = await fetch(`${address}/api/test`);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.message).toBe('Hello from Fastify!');
    });

    it('should support the Inngest use case - starting server from stored app', async () => {
      const mastra = new Mastra({ logger: false });
      app = Fastify();

      // Add routes simulating Mastra's API
      app.get('/api/agents', async () => {
        return { testAgent: { name: 'Test Agent' } };
      });

      app.post<{ Params: { agentId: string }; Body: { prompt?: string } }>(
        '/api/agents/:agentId/generate',
        async request => {
          return { text: `Response to: ${request.body?.prompt || 'no prompt'}` };
        },
      );

      // Wire up - automatically registers with mastra
      new MastraServer({ app, mastra });

      // Get the app via mastra.getServerApp()
      const fastifyApp = mastra.getServerApp<FastifyInstance>();
      expect(fastifyApp).toBeDefined();

      // Start server
      const address = await fastifyApp!.listen({ port: 0 });

      // GET request
      const getResponse = await fetch(`${address}/api/agents`);
      expect(getResponse.status).toBe(200);
      const agents = await getResponse.json();
      expect(agents).toHaveProperty('testAgent');

      // POST request
      const postResponse = await fetch(`${address}/api/agents/test-agent/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello!' }),
      });
      expect(postResponse.status).toBe(200);
      const result = await postResponse.json();
      expect(result.text).toContain('Hello!');
    });
  });

  describe('Adapter with registered routes and middleware', () => {
    let app: FastifyInstance | null = null;

    afterEach(async () => {
      if (app) {
        await app.close();
        app = null;
      }
    });

    it('should expose the app after registering middleware', async () => {
      const mastra = new Mastra({ logger: false });
      app = Fastify();

      // Create adapter with app in constructor - automatically registers
      const adapter = new MastraServer({ app, mastra });

      // Register context middleware (uses this.app internally)
      adapter.registerContextMiddleware();

      // Add a custom route
      app.get('/custom', async () => {
        return { custom: true };
      });

      // Access via mastra.getServerApp()
      const fastifyApp = mastra.getServerApp<FastifyInstance>();
      expect(fastifyApp).toBeDefined();

      // Start server and test
      const address = await fastifyApp!.listen({ port: 0 });

      const response = await fetch(`${address}/custom`);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.custom).toBe(true);
    });
  });
});
