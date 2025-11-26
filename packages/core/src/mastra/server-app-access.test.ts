import { describe, expect, it } from 'vitest';
import { Mastra } from './index';

/**
 * Tests for GitHub Issue #8031: Allow users to access Mastra's server Hono app handle
 *
 * These tests verify that users can access the server app handle from the Mastra instance
 * to call internal routes directly using app.fetch() instead of making HTTP requests.
 *
 * @see https://github.com/mastra-ai/mastra/issues/8031
 */
describe('Server App Access (Issue #8031)', () => {
  describe('Mastra.getServerApp()', () => {
    it('should have getServerApp method on Mastra instance', () => {
      const mastra = new Mastra({
        logger: false,
      });

      // This test verifies the method exists
      // Currently FAILS because getServerApp doesn't exist yet
      expect(typeof mastra.getServerApp).toBe('function');
    });

    it('should return undefined when no server adapter is set', () => {
      const mastra = new Mastra({
        logger: false,
      });

      // When no adapter is set, getServerApp should return undefined
      // Currently FAILS because getServerApp doesn't exist yet
      const app = mastra.getServerApp();
      expect(app).toBeUndefined();
    });
  });

  describe('Mastra.setServerAdapter() and getServerAdapter()', () => {
    it('should have setServerAdapter method on Mastra instance', () => {
      const mastra = new Mastra({
        logger: false,
      });

      // This test verifies the method exists
      // Currently FAILS because setServerAdapter doesn't exist yet
      expect(typeof mastra.setServerAdapter).toBe('function');
    });

    it('should have getServerAdapter method on Mastra instance', () => {
      const mastra = new Mastra({
        logger: false,
      });

      // This test verifies the method exists
      // Currently FAILS because getServerAdapter doesn't exist yet
      expect(typeof mastra.getServerAdapter).toBe('function');
    });

    it('should return undefined when no server adapter is set', () => {
      const mastra = new Mastra({
        logger: false,
      });

      // When no adapter is set, getServerAdapter should return undefined
      // Currently FAILS because getServerAdapter doesn't exist yet
      const adapter = mastra.getServerAdapter();
      expect(adapter).toBeUndefined();
    });

    it('should store and retrieve a server adapter', () => {
      const mastra = new Mastra({
        logger: false,
      });

      // Create a mock adapter that implements MastraServerAdapterBase
      const mockApp = { fetch: () => Promise.resolve(new Response('ok')) };
      const mockAdapter = {
        getApp: <T = unknown>() => mockApp as T,
        setApp: () => {},
        __setLogger: () => {}, // Required by MastraBase
      };

      // Set the adapter
      mastra.setServerAdapter(mockAdapter as any);

      // Retrieve the adapter
      const retrievedAdapter = mastra.getServerAdapter();
      expect(retrievedAdapter).toBe(mockAdapter);
    });

    it('should retrieve the app from the stored adapter via getServerApp', () => {
      const mastra = new Mastra({
        logger: false,
      });

      // Create a mock app (simulating Hono)
      const mockApp = {
        fetch: (request: Request) => Promise.resolve(new Response('ok')),
      };

      // Create a mock adapter
      const mockAdapter = {
        getApp: <T = unknown>() => mockApp as T,
        setApp: () => {},
        __setLogger: () => {}, // Required by MastraBase
      };

      // Set the adapter
      mastra.setServerAdapter(mockAdapter as any);

      // Get the app via convenience method
      const app = mastra.getServerApp();
      expect(app).toBe(mockApp);
    });

    it('should support generic type parameter for getServerApp', () => {
      const mastra = new Mastra({
        logger: false,
      });

      // Define a typed mock app (simulating Hono's interface)
      interface MockHonoApp {
        fetch: (request: Request) => Promise<Response>;
        get: (path: string, handler: () => void) => void;
      }

      const mockApp: MockHonoApp = {
        fetch: (request: Request) => Promise.resolve(new Response('ok')),
        get: (path: string, handler: () => void) => {},
      };

      const mockAdapter = {
        getApp: <T = unknown>() => mockApp as T,
        setApp: () => {},
        __setLogger: () => {}, // Required by MastraBase
      };

      mastra.setServerAdapter(mockAdapter as any);

      // Get the app with type parameter
      const app = mastra.getServerApp<MockHonoApp>();

      // TypeScript should know this has the MockHonoApp interface
      expect(app).toBeDefined();
      expect(typeof app?.fetch).toBe('function');
      expect(typeof app?.get).toBe('function');
    });
  });

  describe('Integration with server app.fetch()', () => {
    it('should allow calling routes directly via app.fetch', async () => {
      const mastra = new Mastra({
        logger: false,
      });

      // Simulate a Hono-like app with a health route
      const mockApp = {
        fetch: async (request: Request) => {
          const url = new URL(request.url);
          if (url.pathname === '/health') {
            return new Response(JSON.stringify({ status: 'ok' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return new Response('Not Found', { status: 404 });
        },
      };

      const mockAdapter = {
        getApp: <T = unknown>() => mockApp as T,
        setApp: () => {},
        __setLogger: () => {}, // Required by MastraBase
      };

      mastra.setServerAdapter(mockAdapter as any);

      // Get the app and call a route directly (the use case from the issue)
      const app = mastra.getServerApp<typeof mockApp>();
      expect(app).toBeDefined();

      const response = await app!.fetch(new Request('http://localhost/health'));
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toEqual({ status: 'ok' });
    });
  });
});
