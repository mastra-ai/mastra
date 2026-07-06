import { describe, expect, it, vi } from 'vitest';
import { Mastra } from './index';

describe('Mastra.__registerFsServer()', () => {
  it('registers fs server config when no code-registered server exists', () => {
    const mastra = new Mastra({ logger: false });

    mastra.__registerFsServer({ port: 4111 } as any);

    expect(mastra.getServer()).toEqual({ port: 4111 });
  });

  it('keeps the code-registered server config on collision', () => {
    const warn = vi.fn();
    const mastra = new Mastra({
      logger: { warn, info: vi.fn(), error: vi.fn(), debug: vi.fn(), trackException: vi.fn() } as any,
      server: { port: 3000 } as any,
    });

    mastra.__registerFsServer({ port: 4111 } as any);

    expect(mastra.getServer()).toEqual({ port: 3000 });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('File-system routed server config conflicts'));
  });

  it('preserves apiRoutes accumulated during construction (e.g. channel webhook routes)', () => {
    const mastra = new Mastra({ logger: false });

    // Simulate construction-time accumulation of channel webhook routes onto
    // #server without an explicit user-provided server config.
    const channelRoute = { path: '/webhooks/slack', method: 'POST', handler: () => {} };
    mastra.setServer({ apiRoutes: [channelRoute] } as any);

    const fsRoute = { path: '/custom', method: 'GET', handler: () => {} };
    mastra.__registerFsServer({ port: 4111, apiRoutes: [fsRoute] } as any);

    expect(mastra.getServer()).toEqual({
      port: 4111,
      apiRoutes: [channelRoute, fsRoute],
    });
  });

  it('does not add an apiRoutes key when neither side has routes', () => {
    const mastra = new Mastra({ logger: false });

    mastra.__registerFsServer({ port: 4111 } as any);

    expect(mastra.getServer()).not.toHaveProperty('apiRoutes');
  });
});
