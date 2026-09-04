import { Mastra } from '@mastra/core/mastra';
import { Elysia } from 'elysia';
import { describe, expect, it } from 'vitest';
import { MastraServer } from '../index';

/**
 * These tests verify that MastraServer (Elysia adapter) properly supports
 * getApp() method inherited from MastraServerBase.
 */
describe('MastraServer (Elysia) - Server App Access', () => {
  describe('getApp()', () => {
    it('should have getApp method', () => {
      const mastra = new Mastra({ logger: false });
      const app = new Elysia();
      const adapter = new MastraServer({ app, mastra });

      expect(typeof adapter.getApp).toBe('function');
    });

    it('should return the app passed to constructor', () => {
      const mastra = new Mastra({ logger: false });
      const app = new Elysia();
      const adapter = new MastraServer({ app, mastra });

      const retrievedApp = adapter.getApp();
      expect(retrievedApp).toBe(app);
    });

    it('should support generic type parameter for getApp', () => {
      const mastra = new Mastra({ logger: false });
      const app = new Elysia();
      app.get('/test', () => ({ message: 'test' }));
      const adapter = new MastraServer({ app, mastra });

      const typedApp = adapter.getApp<Elysia>();
      expect(typedApp).toBe(app);
      expect(typeof typedApp.fetch).toBe('function');
    });
  });

  describe('Integration with Mastra instance', () => {
    it('should automatically register with Mastra in constructor', () => {
      const mastra = new Mastra({ logger: false });
      const app = new Elysia();
      app.get('/health', () => ({ status: 'ok' }));

      new MastraServer({ app, mastra });

      const appFromMastra = mastra.getServerApp<Elysia>();
      expect(appFromMastra).toBe(app);
    });

    it('should return the same app from both adapter and mastra', () => {
      const mastra = new Mastra({ logger: false });
      const app = new Elysia();
      const adapter = new MastraServer({ app, mastra });

      const appFromAdapter = adapter.getApp<Elysia>();
      const appFromMastra = mastra.getServerApp<Elysia>();
      const adapterFromMastra = mastra.getMastraServer();
      const appFromRetrievedAdapter = adapterFromMastra?.getApp<Elysia>();

      expect(appFromAdapter).toBe(app);
      expect(appFromMastra).toBe(app);
      expect(appFromRetrievedAdapter).toBe(app);
    });

    it('should allow calling routes directly via app.fetch() after setup', async () => {
      const mastra = new Mastra({ logger: false });
      const app = new Elysia();

      app.get('/api/test', () => ({
        message: 'Hello from Elysia!',
        timestamp: Date.now(),
      }));

      new MastraServer({ app, mastra });

      const elysiaApp = mastra.getServerApp<Elysia>();
      expect(elysiaApp).toBeDefined();

      const response = await elysiaApp!.fetch(new Request('http://localhost/api/test'));
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.message).toBe('Hello from Elysia!');
      expect(body.timestamp).toBeDefined();
    });

    it('should support the Inngest use case - forwarding requests internally', async () => {
      const mastra = new Mastra({ logger: false });
      const app = new Elysia();

      app.get('/api/agents', () => ({
        testAgent: { name: 'Test Agent' },
      }));

      app.post('/api/agents/:agentId/generate', ({ body }: any) => ({
        text: `Response to: ${body?.prompt || 'no prompt'}`,
      }));

      new MastraServer({ app, mastra });

      const elysiaApp = mastra.getServerApp<Elysia>();
      expect(elysiaApp).toBeDefined();

      const getResponse = await elysiaApp!.fetch(new Request('http://localhost/api/agents'));
      expect(getResponse.status).toBe(200);
      const agents = await getResponse.json();
      expect(agents).toHaveProperty('testAgent');

      const postResponse = await elysiaApp!.fetch(
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
      const app = new Elysia();

      const adapter = new MastraServer({ app, mastra });

      adapter.registerContextMiddleware();

      app.get('/custom', () => ({ custom: true }));

      const elysiaApp = mastra.getServerApp<Elysia>();
      expect(elysiaApp).toBeDefined();

      const response = await elysiaApp!.fetch(new Request('http://localhost/custom'));
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.custom).toBe(true);
    });
  });
});
