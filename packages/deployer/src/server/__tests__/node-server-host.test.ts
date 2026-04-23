import type { Mastra } from '@mastra/core/mastra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNodeServer } from '../index';

const { serveMock } = vi.hoisted(() => ({
  serveMock: vi.fn(),
}));

vi.mock('@hono/node-server', () => ({
  serve: serveMock,
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

describe('createNodeServer host binding', () => {
  let mockMastra: Mastra;
  let logger: {
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MASTRA_HOST;
    delete process.env.PORT;
    delete process.env.MASTRA_HTTPS_KEY;
    delete process.env.MASTRA_HTTPS_CERT;

    logger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    serveMock.mockImplementation((options: any, callback?: () => void) => {
      callback?.();
      // Mock server needs `on` method for @hono/node-ws injectWebSocket
      return { close: vi.fn(), on: vi.fn(), options };
    });

    mockMastra = {
      getServer: vi.fn(() => ({})),
      getServerMiddleware: vi.fn(() => []),
      getLogger: vi.fn(() => logger),
      startEventEngine: vi.fn(),
      listAgents: vi.fn(() => []),
      setMastraServer: vi.fn(),
    } as unknown as Mastra;
  });

  afterEach(() => {
    delete process.env.MASTRA_HOST;
    delete process.env.PORT;
    delete process.env.MASTRA_HTTPS_KEY;
    delete process.env.MASTRA_HTTPS_CERT;
  });

  it('leaves hostname undefined when no host is configured', async () => {
    await createNodeServer(mockMastra, { tools: {} });

    expect(serveMock).toHaveBeenCalledOnce();
    expect(serveMock.mock.calls[0]?.[0]).toMatchObject({
      port: 4111,
      hostname: undefined,
    });
    expect(logger.info).toHaveBeenCalledWith('Mastra API running', { url: 'http://localhost:4111/api' });
  });

  it('uses MASTRA_HOST when it is set', async () => {
    process.env.MASTRA_HOST = '0.0.0.0';

    await createNodeServer(mockMastra, { tools: {} });

    expect(serveMock.mock.calls[0]?.[0]).toMatchObject({
      port: 4111,
      hostname: '0.0.0.0',
    });
    expect(logger.info).toHaveBeenCalledWith('Mastra API running', { url: 'http://0.0.0.0:4111/api' });
  });
});
