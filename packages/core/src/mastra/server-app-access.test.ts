import { describe, expect, it } from 'vitest';
import { Mastra } from './index';

/**
 * These tests verify that users can access the server app handle from the Mastra instance
 * to call internal routes directly using app.fetch() instead of making HTTP requests.
 *
 */
describe('Server App Access', () => {
  describe('Mastra.getServerApp()', () => {
    it('should have getServerApp method on Mastra instance', () => {
      const mastra = new Mastra({
        logger: false,
      });

      expect(typeof mastra.getServerApp).toBe('function');
    });

    it('should return undefined when no server adapter is set', () => {
      const mastra = new Mastra({
        logger: false,
      });

      const app = mastra.getServerApp();
      expect(app).toBeUndefined();
    });
  });

  describe('Mastra.setMastraServer() and getMastraServer()', () => {
    it('should have setMastraServer method on Mastra instance', () => {
      const mastra = new Mastra({
        logger: false,
      });

      expect(typeof mastra.setMastraServer).toBe('function');
    });

    it('should have getMastraServer method on Mastra instance', () => {
      const mastra = new Mastra({
        logger: false,
      });

      expect(typeof mastra.getMastraServer).toBe('function');
    });

    it('should return undefined when no server adapter is set', () => {
      const mastra = new Mastra({
        logger: false,
      });

      const adapter = mastra.getMastraServer();
      expect(adapter).toBeUndefined();
    });

    it('should store and retrieve a server adapter', () => {
      const mastra = new Mastra({
        logger: false,
      });

      // Create a mock adapter that implements MastraServerBase
      const mockApp = { fetch: () => Promise.resolve(new Response('ok')) };
      const mockAdapter = {
        getApp: <T = unknown>() => mockApp as T,
        __setLogger: () => {}, // Required by MastraBase
      };

      // Set the adapter
      mastra.setMastraServer(mockAdapter as any);

      // Retrieve the adapter
      const retrievedAdapter = mastra.getMastraServer();
      expect(retrievedAdapter).toBe(mockAdapter);
    });

    it('should retrieve the app from the stored adapter via getServerApp', () => {
      const mastra = new Mastra({
        logger: false,
      });

      // Create a mock app (simulating Hono)
      const mockApp = {
        fetch: () => Promise.resolve(new Response('ok')),
      };

      // Create a mock adapter
      const mockAdapter = {
        getApp: <T = unknown>() => mockApp as T,
        __setLogger: () => {}, // Required by MastraBase
      };

      // Set the adapter
      mastra.setMastraServer(mockAdapter as any);

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
        fetch: () => Promise.resolve(new Response('ok')),
        get: () => {},
      };

      const mockAdapter = {
        getApp: <T = unknown>() => mockApp as T,
        __setLogger: () => {}, // Required by MastraBase
      };

      mastra.setMastraServer(mockAdapter as any);

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
        __setLogger: () => {}, // Required by MastraBase
      };

      mastra.setMastraServer(mockAdapter as any);

      // Get the app and call a route directly (the use case from the issue)
      const app = mastra.getServerApp<typeof mockApp>();
      expect(app).toBeDefined();

      const response = await app!.fetch(new Request('http://localhost/health'));
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toEqual({ status: 'ok' });
    });
  });

  /**
   * Using mastra.getServerApp() in an Inngest function to forward requests
   * internally without making HTTP requests to localhost.
   *
   * Original issue use case:
   * ```typescript
   * // Current workaround (suboptimal)
   * const response = await fetch(`http://localhost:5000${path}`, {
   *   method: event.data.method,
   *   headers: event.data.headers,
   *   body: event.data.body,
   * });
   *
   * // Desired approach
   * const app = mastra.getServerApp<Hono>();
   * const response = await app.fetch(new Request('/api/agents'));
   * ```
   */
  describe('Inngest-like use case', () => {
    // Mock app that simulates a full API with multiple routes
    function createMockApiApp() {
      return {
        fetch: async (request: Request) => {
          const url = new URL(request.url);
          const path = url.pathname;
          const method = request.method;

          // Simulate /api/agents endpoint
          if (path === '/api/agents' && method === 'GET') {
            return new Response(
              JSON.stringify({
                myAgent: { name: 'My Agent', description: 'A test agent' },
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            );
          }

          // Simulate /api/agents/:agentId/generate endpoint
          if (path.match(/^\/api\/agents\/[\w-]+\/generate$/) && method === 'POST') {
            const body = await request.json();
            return new Response(
              JSON.stringify({
                text: `Generated response for: ${body.messages?.[0]?.content || 'no message'}`,
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            );
          }

          // Simulate /api/workflows/:workflowId/start endpoint
          if (path.match(/^\/api\/workflows\/[\w-]+\/start$/) && method === 'POST') {
            const body = await request.json();
            return new Response(
              JSON.stringify({
                runId: 'run-123',
                status: 'started',
                input: body.input,
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            );
          }

          return new Response(JSON.stringify({ error: 'Not Found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        },
      };
    }

    it('should forward GET requests internally like Inngest function would', async () => {
      const mastra = new Mastra({ logger: false });

      const mockApp = createMockApiApp();
      const mockAdapter = {
        getApp: <T = unknown>() => mockApp as T,
        __setLogger: () => {},
      };

      mastra.setMastraServer(mockAdapter as any);

      // Simulate Inngest function receiving an event with request data
      const inngestEvent = {
        data: {
          path: '/api/agents',
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      };

      // Use mastra.getServerApp() instead of fetch('http://localhost:...')
      const app = mastra.getServerApp<typeof mockApp>();
      expect(app).toBeDefined();

      const response = await app!.fetch(
        new Request(`http://internal${inngestEvent.data.path}`, {
          method: inngestEvent.data.method,
          headers: inngestEvent.data.headers,
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('myAgent');
      expect(body.myAgent.name).toBe('My Agent');
    });

    it('should forward POST requests with body internally like Inngest function would', async () => {
      const mastra = new Mastra({ logger: false });

      const mockApp = createMockApiApp();
      const mockAdapter = {
        getApp: <T = unknown>() => mockApp as T,
        __setLogger: () => {},
      };

      mastra.setMastraServer(mockAdapter as any);

      // Simulate Inngest function receiving an event to generate agent response
      const inngestEvent = {
        data: {
          path: '/api/agents/my-agent/generate',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'Hello, agent!' }],
          }),
        },
      };

      const app = mastra.getServerApp<typeof mockApp>();
      expect(app).toBeDefined();

      const response = await app!.fetch(
        new Request(`http://internal${inngestEvent.data.path}`, {
          method: inngestEvent.data.method,
          headers: inngestEvent.data.headers,
          body: inngestEvent.data.body,
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.text).toContain('Hello, agent!');
    });

    it('should forward workflow start requests internally like Inngest function would', async () => {
      const mastra = new Mastra({ logger: false });

      const mockApp = createMockApiApp();
      const mockAdapter = {
        getApp: <T = unknown>() => mockApp as T,
        __setLogger: () => {},
      };

      mastra.setMastraServer(mockAdapter as any);

      // Simulate Inngest function triggering a workflow
      const inngestEvent = {
        data: {
          path: '/api/workflows/data-pipeline/start',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { sourceUrl: 'https://example.com/data.csv' },
          }),
        },
      };

      const app = mastra.getServerApp<typeof mockApp>();
      expect(app).toBeDefined();

      const response = await app!.fetch(
        new Request(`http://internal${inngestEvent.data.path}`, {
          method: inngestEvent.data.method,
          headers: inngestEvent.data.headers,
          body: inngestEvent.data.body,
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.runId).toBe('run-123');
      expect(body.status).toBe('started');
      expect(body.input).toEqual({ sourceUrl: 'https://example.com/data.csv' });
    });

    it('should handle 404 responses for unknown routes', async () => {
      const mastra = new Mastra({ logger: false });

      const mockApp = createMockApiApp();
      const mockAdapter = {
        getApp: <T = unknown>() => mockApp as T,
        __setLogger: () => {},
      };

      mastra.setMastraServer(mockAdapter as any);

      const app = mastra.getServerApp<typeof mockApp>();
      expect(app).toBeDefined();

      const response = await app!.fetch(new Request('http://internal/api/unknown-route'));

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Not Found');
    });

    it('should work with Request objects created from event data (full Inngest pattern)', async () => {
      const mastra = new Mastra({ logger: false });

      const mockApp = createMockApiApp();
      const mockAdapter = {
        getApp: <T = unknown>() => mockApp as T,
        __setLogger: () => {},
      };

      mastra.setMastraServer(mockAdapter as any);

      async function handleInngestEvent(event: {
        data: {
          path: string;
          method: string;
          headers: Record<string, string>;
          body?: string;
        };
      }) {
        const app = mastra.getServerApp<{ fetch: (req: Request) => Promise<Response> }>();
        if (!app) {
          throw new Error('Server app not available');
        }

        const request = new Request(`http://localhost${event.data.path}`, {
          method: event.data.method,
          headers: event.data.headers,
          body: event.data.body,
        });

        return app.fetch(request);
      }

      // Test the helper function with a real-world-like event
      const response = await handleInngestEvent({
        data: {
          path: '/api/agents',
          method: 'GET',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token123' },
        },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('myAgent');
    });
  });
});
