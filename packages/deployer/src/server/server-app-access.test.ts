import { Mastra } from '@mastra/core/mastra';
import type { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createHonoServer } from './index';

/**
 * These tests verify that users can access the Hono app handle via mastra.getServerApp()
 * after calling createHonoServer().
 */
describe('Server App Access via createHonoServer', () => {
  it('should expose the Hono app via mastra.getServerApp() after createHonoServer()', async () => {
    const mastra = new Mastra({
      logger: false,
    });

    // Create the Hono server
    const returnedApp = await createHonoServer(mastra, { tools: {} });

    // Get the app via mastra.getServerApp()
    const app = mastra.getServerApp<Hono>();

    // The app should be defined and be the same as the returned app
    expect(app).toBeDefined();
    expect(app).toBe(returnedApp);
  });

  it('should expose the server adapter via mastra.getMastraServer()', async () => {
    const mastra = new Mastra({
      logger: false,
    });

    await createHonoServer(mastra, { tools: {} });

    const adapter = mastra.getMastraServer();

    expect(adapter).toBeDefined();
    expect(typeof adapter?.getApp).toBe('function');
  });

  it('should allow calling routes directly via app.fetch() - the primary use case', async () => {
    const mastra = new Mastra({
      logger: false,
    });

    await createHonoServer(mastra, { tools: {} });

    const app = mastra.getServerApp<Hono>();
    expect(app).toBeDefined();

    // Call the health endpoint directly without HTTP overhead
    const response = await app!.fetch(new Request('http://localhost/health'));

    expect(response.status).toBe(200);
    const body = await response.json();
    // Health endpoint returns { success: true }
    expect(body).toHaveProperty('success', true);
  });

  it('should allow calling API routes directly via app.fetch()', async () => {
    const mastra = new Mastra({
      logger: false,
    });

    await createHonoServer(mastra, { tools: {} });

    const app = mastra.getServerApp<Hono>();
    expect(app).toBeDefined();

    // Call the agents list endpoint directly
    const response = await app!.fetch(new Request('http://localhost/api/agents'));

    // Should return 200 with empty agents object (no agents configured)
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({});
  });

  it('should return the same app instance from adapter.getApp() and mastra.getServerApp()', async () => {
    const mastra = new Mastra({
      logger: false,
    });

    await createHonoServer(mastra, { tools: {} });

    const appFromMastra = mastra.getServerApp<Hono>();
    const adapter = mastra.getMastraServer();
    const appFromAdapter = adapter?.getApp<Hono>();

    expect(appFromMastra).toBe(appFromAdapter);
  });

  it('should handle GET requests via app.fetch()', async () => {
    const mastra = new Mastra({
      logger: false,
    });

    await createHonoServer(mastra, { tools: {} });

    const app = mastra.getServerApp<Hono>();
    expect(app).toBeDefined();

    const response = await app!.fetch(
      new Request('http://localhost/api/tools', {
        method: 'GET',
      }),
    );

    expect(response.status).toBe(200);
  });

  it('should return 404 for non-existent routes', async () => {
    const mastra = new Mastra({
      logger: false,
    });

    await createHonoServer(mastra, { tools: {} });

    const app = mastra.getServerApp<Hono>();
    expect(app).toBeDefined();

    // Call a route that doesn't exist
    const response = await app!.fetch(new Request('http://localhost/api/non-existent-route'));

    expect(response.status).toBe(404);
  });
});
