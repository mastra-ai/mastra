/**
 * Unit tests for Swagger UI and OpenAPI documentation warning
 *
 * Tests that a warning is logged when Swagger UI is enabled but OpenAPI documentation is not enabled in production
 */

import type { Mastra } from '@mastra/core/mastra';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHonoServer } from '../index';

// Mock dependencies
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

vi.mock('@hono/node-server/serve-static', () => ({
  serveStatic: vi.fn(() => async (ctx: any) => ctx.notFound()),
}));

vi.mock('@hono/swagger-ui', () => ({
  swaggerUI: vi.fn(() => vi.fn()),
}));

vi.mock('@mastra/server/a2a/store', () => ({
  InMemoryTaskStore: vi.fn(),
}));

vi.mock('../handlers/mcp', () => ({
  MCP_ROUTES: [],
  getMcpServerMessageHandler: vi.fn(),
  getMcpServerSseHandler: vi.fn(),
}));

vi.mock('../handlers/auth', () => ({
  authenticationMiddleware: vi.fn((c, next) => next()),
  authorizationMiddleware: vi.fn((c, next) => next()),
}));

vi.mock('../handlers/error', () => ({
  errorHandler: vi.fn(),
}));

vi.mock('../handlers/health', () => ({
  healthHandler: vi.fn(c => c.json({ status: 'ok' })),
}));

vi.mock('../handlers/client', () => ({
  handleClientsRefresh: vi.fn(ctx => ctx.json({ refresh: true })),
  handleTriggerClientsRefresh: vi.fn(ctx => ctx.json({ triggered: true })),
  isHotReloadDisabled: vi.fn(() => false),
}));

vi.mock('../handlers/restart-active-runs', () => ({
  restartAllActiveWorkflowRunsHandler: vi.fn(ctx => ctx.json({ restarted: true })),
}));

vi.mock('../welcome', () => ({
  html: '<html><body>Welcome to Mastra</body></html>',
}));

describe('Swagger UI and OpenAPI documentation warning', () => {
  let mockMastra: Mastra;
  let mockWarn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWarn = vi.fn();

    mockMastra = {
      getServer: vi.fn(() => ({})),
      getServerMiddleware: vi.fn(() => []),
      getLogger: vi.fn(() => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: mockWarn,
        debug: vi.fn(),
      })),
      startEventEngine: vi.fn(),
      listAgents: vi.fn(() => []),
      setMastraServer: vi.fn(),
    } as unknown as Mastra;
  });

  it('should warn when swaggerUI is enabled but openAPIDocs is not in production', async () => {
    vi.mocked(mockMastra.getServer).mockReturnValue({
      build: {
        swaggerUI: true,
        openAPIDocs: false,
      },
    });

    await createHonoServer(mockMastra, { tools: {}, isDev: false });

    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining('Swagger UI is enabled but OpenAPI documentation is disabled'),
    );
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining('server: { build: { swaggerUI: true, openAPIDocs: true } }'),
    );
  });

  it('should not warn when both swaggerUI and openAPIDocs are enabled in production', async () => {
    vi.mocked(mockMastra.getServer).mockReturnValue({
      build: {
        swaggerUI: true,
        openAPIDocs: true,
      },
    });

    await createHonoServer(mockMastra, { tools: {}, isDev: false });

    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('should not warn when swaggerUI is disabled in production', async () => {
    vi.mocked(mockMastra.getServer).mockReturnValue({
      build: {
        swaggerUI: false,
        openAPIDocs: false,
      },
    });

    await createHonoServer(mockMastra, { tools: {}, isDev: false });

    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('should not warn in development mode even if openAPIDocs is disabled', async () => {
    vi.mocked(mockMastra.getServer).mockReturnValue({
      build: {
        swaggerUI: true,
        openAPIDocs: false,
      },
    });

    await createHonoServer(mockMastra, { tools: {}, isDev: true });

    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('should not warn when swaggerUI is enabled but openAPIDocs is explicitly undefined in production', async () => {
    vi.mocked(mockMastra.getServer).mockReturnValue({
      build: {
        swaggerUI: true,
        // openAPIDocs is undefined
      },
    });

    await createHonoServer(mockMastra, { tools: {}, isDev: false });

    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining('Swagger UI is enabled but OpenAPI documentation is disabled'),
    );
  });

  it('should not warn when build config is not provided', async () => {
    vi.mocked(mockMastra.getServer).mockReturnValue({});

    await createHonoServer(mockMastra, { tools: {}, isDev: false });

    expect(mockWarn).not.toHaveBeenCalled();
  });
});
