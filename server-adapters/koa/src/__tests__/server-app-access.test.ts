import type { Server } from 'node:http';
import { Mastra } from '@mastra/core/mastra';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { afterEach, describe, expect, it } from 'vitest';
import { MastraServer } from '../index';

/**
 * These tests verify that MastraServer (Koa adapter) properly supports
 * getApp() method inherited from MastraServerBase.
 *
 * These tests focus on verifying the adapter's getApp functionality
 * and demonstrate how users would access the Koa app.
 */
describe('MastraServer (Koa) - Server App Access', () => {
  describe('getApp()', () => {
    it('should have getApp method', () => {
      const mastra = new Mastra({ logger: false });
      const app = new Koa();
      const adapter = new MastraServer({ app, mastra });

      expect(typeof adapter.getApp).toBe('function');
    });

    it('should return the app passed to constructor', () => {
      const mastra = new Mastra({ logger: false });
      const app = new Koa();
      const adapter = new MastraServer({ app, mastra });

      const retrievedApp = adapter.getApp();
      expect(retrievedApp).toBe(app);
    });

    it('should support generic type parameter for getApp', () => {
      const mastra = new Mastra({ logger: false });
      const app = new Koa();
      const adapter = new MastraServer({ app, mastra });

      // Get with specific type
      const typedApp = adapter.getApp<Koa>();
      expect(typedApp).toBe(app);
      expect(typeof typedApp.use).toBe('function');
      expect(typeof typedApp.listen).toBe('function');
    });
  });

  describe('Integration with Mastra instance', () => {
    it('should automatically register with Mastra in constructor', () => {
      const mastra = new Mastra({ logger: false });
      const app = new Koa();

      // Creating the adapter automatically registers it with Mastra
      new MastraServer({ app, mastra });

      // Access app via Mastra
      const appFromMastra = mastra.getServerApp<Koa>();
      expect(appFromMastra).toBe(app);
    });

    it('should return the same app from both adapter and mastra', () => {
      const mastra = new Mastra({ logger: false });
      const app = new Koa();
      const adapter = new MastraServer({ app, mastra });

      const appFromAdapter = adapter.getApp<Koa>();
      const appFromMastra = mastra.getServerApp<Koa>();
      const adapterFromMastra = mastra.getMastraServer();
      const appFromRetrievedAdapter = adapterFromMastra?.getApp<Koa>();

      expect(appFromAdapter).toBe(app);
      expect(appFromMastra).toBe(app);
      expect(appFromRetrievedAdapter).toBe(app);
    });
  });

  describe('Koa app with HTTP server', () => {
    let server: Server | null = null;

    afterEach(async () => {
      if (server) {
        await new Promise<void>((resolve, reject) => {
          server!.close(err => {
            if (err) reject(err);
            else resolve();
          });
        });
        server = null;
      }
    });

    it('should allow starting a server and making requests using the stored app', async () => {
      const mastra = new Mastra({ logger: false });
      const app = new Koa();
      app.use(bodyParser());

      // Add a test route
      app.use(async ctx => {
        if (ctx.path === '/api/test' && ctx.method === 'GET') {
          ctx.body = { message: 'Hello from Koa!' };
        }
      });

      // Wire up the adapter - automatically registers with mastra
      new MastraServer({ app, mastra });

      // Get the app via mastra.getServerApp() and start a server
      const koaApp = mastra.getServerApp<Koa>();
      expect(koaApp).toBeDefined();

      // Start server on random port
      server = await new Promise(resolve => {
        const s = koaApp!.listen(0, () => resolve(s));
      });

      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      // Make a request to the server
      const response = await fetch(`http://localhost:${port}/api/test`);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.message).toBe('Hello from Koa!');
    });

    it('should support the Inngest use case - starting server from stored app', async () => {
      const mastra = new Mastra({ logger: false });
      const app = new Koa();
      app.use(bodyParser());

      // Add routes simulating Mastra's API
      app.use(async ctx => {
        if (ctx.path === '/api/agents' && ctx.method === 'GET') {
          ctx.body = { testAgent: { name: 'Test Agent' } };
        } else if (ctx.path.startsWith('/api/agents/') && ctx.method === 'POST') {
          const body = ctx.request.body as { prompt?: string };
          ctx.body = { text: `Response to: ${body?.prompt || 'no prompt'}` };
        }
      });

      // Wire up - automatically registers with mastra
      new MastraServer({ app, mastra });

      // Get the app via mastra.getServerApp()
      const koaApp = mastra.getServerApp<Koa>();
      expect(koaApp).toBeDefined();

      // Start server
      server = await new Promise(resolve => {
        const s = koaApp!.listen(0, () => resolve(s));
      });

      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      // GET request
      const getResponse = await fetch(`http://localhost:${port}/api/agents`);
      expect(getResponse.status).toBe(200);
      const agents = await getResponse.json();
      expect(agents).toHaveProperty('testAgent');

      // POST request
      const postResponse = await fetch(`http://localhost:${port}/api/agents/test-agent/generate`, {
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
    let server: Server | null = null;

    afterEach(async () => {
      if (server) {
        await new Promise<void>((resolve, reject) => {
          server!.close(err => {
            if (err) reject(err);
            else resolve();
          });
        });
        server = null;
      }
    });

    it('should expose the app after registering middleware', async () => {
      const mastra = new Mastra({ logger: false });
      const app = new Koa();
      app.use(bodyParser());

      // Create adapter with app in constructor - automatically registers
      const adapter = new MastraServer({ app, mastra });

      // Register context middleware (uses this.app internally)
      adapter.registerContextMiddleware();

      // Add a custom route
      app.use(async ctx => {
        if (ctx.path === '/custom' && ctx.method === 'GET') {
          ctx.body = { custom: true };
        }
      });

      // Access via mastra.getServerApp()
      const koaApp = mastra.getServerApp<Koa>();
      expect(koaApp).toBeDefined();

      // Start server and test
      server = await new Promise(resolve => {
        const s = koaApp!.listen(0, () => resolve(s));
      });

      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const response = await fetch(`http://localhost:${port}/custom`);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.custom).toBe(true);
    });
  });
});
