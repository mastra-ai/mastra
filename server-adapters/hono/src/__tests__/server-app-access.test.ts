import { Mastra } from '@mastra/core/mastra';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { MastraServer } from '../index';

/**
 * These tests verify that MastraServer (Hono adapter) properly supports
 * getApp() method inherited from MastraServerBase.
 */
describe('MastraServer (Hono) - Server App Access', () => {
  describe('getApp()', () => {
    it('should have getApp method', () => {
      const mastra = new Mastra({ logger: false });
      const app = new Hono();
      const adapter = new MastraServer({ app, mastra });

      expect(typeof adapter.getApp).toBe('function');
    });

    it('should return the app passed to constructor', () => {
      const mastra = new Mastra({ logger: false });
      const app = new Hono();
      const adapter = new MastraServer({ app, mastra });

      const retrievedApp = adapter.getApp();
      expect(retrievedApp).toBe(app);
    });

    it('should support generic type parameter for getApp', () => {
      const mastra = new Mastra({ logger: false });
      const app = new Hono();
      app.get('/test', c => c.json({ message: 'test' }));
      const adapter = new MastraServer({ app, mastra });

      // Get with specific type
      const typedApp = adapter.getApp<Hono>();
      expect(typedApp).toBe(app);
      expect(typeof typedApp.fetch).toBe('function');
    });
  });

  describe('Integration with Mastra instance', () => {
    it('should automatically register with Mastra in constructor', () => {
      const mastra = new Mastra({ logger: false });
      const app = new Hono();
      app.get('/health', c => c.json({ status: 'ok' }));

      // Creating the adapter automatically registers it with Mastra
      new MastraServer({ app, mastra });

      // Access app via Mastra
      const appFromMastra = mastra.getServerApp<Hono>();
      expect(appFromMastra).toBe(app);
    });

    it('should return the same app from both adapter and mastra', () => {
      const mastra = new Mastra({ logger: false });
      const app = new Hono();
      const adapter = new MastraServer({ app, mastra });

      const appFromAdapter = adapter.getApp<Hono>();
      const appFromMastra = mastra.getServerApp<Hono>();
      const adapterFromMastra = mastra.getMastraServer();
      const appFromRetrievedAdapter = adapterFromMastra?.getApp<Hono>();

      expect(appFromAdapter).toBe(app);
      expect(appFromMastra).toBe(app);
      expect(appFromRetrievedAdapter).toBe(app);
    });

    it('should allow calling routes directly via app.fetch() after setup', async () => {
      const mastra = new Mastra({ logger: false });
      const app = new Hono();

      // Create a Hono app with a test route
      app.get('/api/test', c =>
        c.json({
          message: 'Hello from Hono!',
          timestamp: Date.now(),
        }),
      );

      // Wire up the adapter - automatically registers with mastra
      new MastraServer({ app, mastra });

      // Access the app and call the route directly
      const honoApp = mastra.getServerApp<Hono>();
      expect(honoApp).toBeDefined();

      const response = await honoApp!.fetch(new Request('http://localhost/api/test'));
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.message).toBe('Hello from Hono!');
      expect(body.timestamp).toBeDefined();
    });

    it('should support the Inngest use case - forwarding requests internally', async () => {
      const mastra = new Mastra({ logger: false });
      const app = new Hono();

      // Create a Hono app simulating Mastra's API
      app.get('/api/agents', c =>
        c.json({
          testAgent: { name: 'Test Agent' },
        }),
      );

      app.post('/api/agents/:agentId/generate', async c => {
        const body = await c.req.json();
        return c.json({
          text: `Response to: ${body.prompt || 'no prompt'}`,
        });
      });

      // Wire up - automatically registers with mastra
      new MastraServer({ app, mastra });

      // Simulate Inngest function forwarding a request
      const honoApp = mastra.getServerApp<Hono>();
      expect(honoApp).toBeDefined();

      // Forward a GET request
      const getResponse = await honoApp!.fetch(new Request('http://localhost/api/agents'));
      expect(getResponse.status).toBe(200);
      const agents = await getResponse.json();
      expect(agents).toHaveProperty('testAgent');

      // Forward a POST request with body
      const postResponse = await honoApp!.fetch(
        new Request('http://localhost/api/agents/test-agent/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: 'Hello!' }),
        }),
      );
      expect(postResponse.status).toBe(200);
      const result = await postResponse.json();
      expect(result.text).toContain('Hello!');
    });
  });

  describe('Adapter with registered routes', () => {
    it('should expose the app after registering routes', async () => {
      const mastra = new Mastra({ logger: false });
      const app = new Hono();

      // Create adapter with app passed in constructor - automatically registers
      const adapter = new MastraServer({ app, mastra });

      // Register context middleware (uses this.app internally)
      adapter.registerContextMiddleware();

      // Add a custom route
      app.get('/custom', c => c.json({ custom: true }));

      // Access via mastra.getServerApp()
      const honoApp = mastra.getServerApp<Hono>();
      expect(honoApp).toBeDefined();

      const response = await honoApp!.fetch(new Request('http://localhost/custom'));
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.custom).toBe(true);
    });
  });
});
