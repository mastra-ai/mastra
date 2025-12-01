import type { Server } from 'node:http';
import { Mastra } from '@mastra/core/mastra';
import express from 'express';
import type { Application } from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { MastraServer } from '../index';

/**
 * These tests verify that the ExpressServerAdapter properly supports
 * setApp() and getApp() methods inherited from MastraServerAdapterBase.
 *
 * These tests focus on verifying the adapter's setApp/getApp functionality
 * and demonstrate how users would access the Express app.
 */
describe('ExpressServerAdapter - Server App Access', () => {
  describe('setApp() and getApp()', () => {
    it('should have setApp method', () => {
      const mastra = new Mastra({ logger: false });
      const adapter = new MastraServer({ mastra });

      expect(typeof adapter.setApp).toBe('function');
    });

    it('should have getApp method', () => {
      const mastra = new Mastra({ logger: false });
      const adapter = new MastraServer({ mastra });

      expect(typeof adapter.getApp).toBe('function');
    });

    it('should return undefined when no app is set', () => {
      const mastra = new Mastra({ logger: false });
      const adapter = new MastraServer({ mastra });

      const app = adapter.getApp();
      expect(app).toBeUndefined();
    });

    it('should store and retrieve an Express app', () => {
      const mastra = new Mastra({ logger: false });
      const adapter = new MastraServer({ mastra });

      const app = express();
      adapter.setApp(app);

      const retrievedApp = adapter.getApp();
      expect(retrievedApp).toBe(app);
    });

    it('should support generic type parameter for getApp', () => {
      const mastra = new Mastra({ logger: false });
      const adapter = new MastraServer({ mastra });

      const app = express();
      adapter.setApp(app);

      // Get with specific type
      const typedApp = adapter.getApp<Application>();
      expect(typedApp).toBe(app);
      expect(typeof typedApp?.get).toBe('function');
      expect(typeof typedApp?.post).toBe('function');
      expect(typeof typedApp?.listen).toBe('function');
    });
  });

  describe('Integration with Mastra instance', () => {
    it('should work when registered with Mastra via setServerAdapter', () => {
      const mastra = new Mastra({ logger: false });
      const adapter = new MastraServer({ mastra });

      const app = express();
      adapter.setApp(app);

      // Register adapter with Mastra
      mastra.setServerAdapter(adapter);

      // Access app via Mastra
      const appFromMastra = mastra.getServerApp<Application>();
      expect(appFromMastra).toBe(app);
    });

    it('should return the same app from both adapter and mastra', () => {
      const mastra = new Mastra({ logger: false });
      const adapter = new MastraServer({ mastra });

      const app = express();
      adapter.setApp(app);
      mastra.setServerAdapter(adapter);

      const appFromAdapter = adapter.getApp<Application>();
      const appFromMastra = mastra.getServerApp<Application>();
      const adapterFromMastra = mastra.getServerAdapter();
      const appFromRetrievedAdapter = adapterFromMastra?.getApp<Application>();

      expect(appFromAdapter).toBe(app);
      expect(appFromMastra).toBe(app);
      expect(appFromRetrievedAdapter).toBe(app);
    });
  });

  describe('Express app with HTTP server', () => {
    let server: Server | null = null;

    afterEach(async () => {
      if (server) {
        await new Promise<void>(resolve => {
          server!.close(() => resolve());
        });
        server = null;
      }
    });

    it('should allow starting a server and making requests using the stored app', async () => {
      const mastra = new Mastra({ logger: false });
      const adapter = new MastraServer({ mastra });

      const app = express();
      app.use(express.json());

      // Add a test route
      app.get('/api/test', (req, res) => {
        res.json({ message: 'Hello from Express!' });
      });

      // Wire up the adapter
      adapter.setApp(app);
      mastra.setServerAdapter(adapter);

      // Get the app via mastra.getServerApp() and start a server
      const expressApp = mastra.getServerApp<Application>();
      expect(expressApp).toBeDefined();

      // Start server on random port
      server = await new Promise<Server>(resolve => {
        const s = expressApp!.listen(0, () => resolve(s));
      });

      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }
      const port = address.port;

      // Make a request to the server
      const response = await fetch(`http://localhost:${port}/api/test`);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.message).toBe('Hello from Express!');
    });

    it('should support the Inngest use case - starting server from stored app', async () => {
      const mastra = new Mastra({ logger: false });
      const adapter = new MastraServer({ mastra });

      const app = express();
      app.use(express.json());

      // Add routes simulating Mastra's API
      app.get('/api/agents', (req, res) => {
        res.json({ testAgent: { name: 'Test Agent' } });
      });

      app.post('/api/agents/:agentId/generate', (req, res) => {
        res.json({ text: `Response to: ${req.body?.prompt || 'no prompt'}` });
      });

      // Wire up
      adapter.setApp(app);
      mastra.setServerAdapter(adapter);

      // Get the app via mastra.getServerApp()
      const expressApp = mastra.getServerApp<Application>();
      expect(expressApp).toBeDefined();

      // Start server
      server = await new Promise<Server>(resolve => {
        const s = expressApp!.listen(0, () => resolve(s));
      });

      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }
      const port = address.port;

      // Simulate Inngest forwarding requests to this server
      // (In a real Inngest setup, you'd use app.fetch() if available,
      // but Express doesn't have native fetch - you'd need to make HTTP requests)

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
        await new Promise<void>(resolve => {
          server!.close(() => resolve());
        });
        server = null;
      }
    });

    it('should expose the app after registering middleware', async () => {
      const mastra = new Mastra({ logger: false });
      const adapter = new MastraServer({ mastra });

      const app = express();
      app.use(express.json());

      // Register context middleware (like in real setup)
      adapter.registerContextMiddleware(app);

      // Add a custom route
      app.get('/custom', (req, res) => {
        res.json({ custom: true });
      });

      // Wire up
      adapter.setApp(app);
      mastra.setServerAdapter(adapter);

      // Access via mastra.getServerApp()
      const expressApp = mastra.getServerApp<Application>();
      expect(expressApp).toBeDefined();

      // Start server and test
      server = await new Promise<Server>(resolve => {
        const s = expressApp!.listen(0, () => resolve(s));
      });

      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }
      const port = address.port;

      const response = await fetch(`http://localhost:${port}/custom`);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.custom).toBe(true);
    });
  });
});
