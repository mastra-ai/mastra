import { Mastra } from '@mastra/core/mastra';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { HonoServerAdapter } from '../index';

/**
 * These tests verify that the HonoServerAdapter properly supports
 * setApp() and getApp() methods inherited from MastraServerAdapterBase.
 *
 * This enables the use case from issue #8031: accessing the Hono app
 * via mastra.getServerApp() to call routes directly.
 */
describe('HonoServerAdapter - Server App Access', () => {
  describe('setApp() and getApp()', () => {
    it('should have setApp method', () => {
      const mastra = new Mastra({ logger: false });
      const adapter = new HonoServerAdapter({ mastra });

      expect(typeof adapter.setApp).toBe('function');
    });

    it('should have getApp method', () => {
      const mastra = new Mastra({ logger: false });
      const adapter = new HonoServerAdapter({ mastra });

      expect(typeof adapter.getApp).toBe('function');
    });

    it('should return undefined when no app is set', () => {
      const mastra = new Mastra({ logger: false });
      const adapter = new HonoServerAdapter({ mastra });

      const app = adapter.getApp();
      expect(app).toBeUndefined();
    });

    it('should store and retrieve a Hono app', () => {
      const mastra = new Mastra({ logger: false });
      const adapter = new HonoServerAdapter({ mastra });

      const app = new Hono();
      adapter.setApp(app);

      const retrievedApp = adapter.getApp();
      expect(retrievedApp).toBe(app);
    });

    it('should support generic type parameter for getApp', () => {
      const mastra = new Mastra({ logger: false });
      const adapter = new HonoServerAdapter({ mastra });

      const app = new Hono();
      app.get('/test', c => c.json({ message: 'test' }));
      adapter.setApp(app);

      // Get with specific type
      const typedApp = adapter.getApp<Hono>();
      expect(typedApp).toBe(app);
      expect(typeof typedApp?.fetch).toBe('function');
    });
  });

  describe('Integration with Mastra instance', () => {
    it('should work when registered with Mastra via setServerAdapter', () => {
      const mastra = new Mastra({ logger: false });
      const adapter = new HonoServerAdapter({ mastra });

      const app = new Hono();
      app.get('/health', c => c.json({ status: 'ok' }));
      adapter.setApp(app);

      // Register adapter with Mastra
      mastra.setServerAdapter(adapter);

      // Access app via Mastra
      const appFromMastra = mastra.getServerApp<Hono>();
      expect(appFromMastra).toBe(app);
    });

    it('should allow calling routes directly via app.fetch() after setup', async () => {
      const mastra = new Mastra({ logger: false });
      const adapter = new HonoServerAdapter({ mastra });

      // Create a Hono app with a test route
      const app = new Hono();
      app.get('/api/test', c =>
        c.json({
          message: 'Hello from Hono!',
          timestamp: Date.now(),
        }),
      );

      // Wire up the adapter
      adapter.setApp(app);
      mastra.setServerAdapter(adapter);

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
      const adapter = new HonoServerAdapter({ mastra });

      // Create a Hono app simulating Mastra's API
      const app = new Hono();

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

      // Wire up
      adapter.setApp(app);
      mastra.setServerAdapter(adapter);

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
      const adapter = new HonoServerAdapter({ mastra });

      const app = new Hono();

      // Simulate the pattern used in createHonoServer
      adapter.registerContextMiddleware(app);
      adapter.setApp(app);
      mastra.setServerAdapter(adapter);

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
