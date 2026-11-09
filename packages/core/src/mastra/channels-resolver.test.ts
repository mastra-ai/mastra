import { describe, expect, it, vi } from 'vitest';
import type { ChannelProvider, ChannelsResolver } from '../channels';
import type { ApiRoute } from '../server/types';
import { Mastra } from './index';

function fakeProvider(id: string): ChannelProvider {
  return {
    id,
    getRoutes: vi.fn((): ApiRoute[] => [
      { path: `/${id}/webhook`, method: 'POST', handler: async (c: any) => c.text('ok') },
    ]),
    __attach: vi.fn(),
    initialize: vi.fn(async () => {}),
  };
}

function fakeResolver(
  resolve: () => Promise<Record<string, ChannelProvider>>,
  routes: ApiRoute[] = [],
): ChannelsResolver {
  const resolver = (() => resolve()) as ChannelsResolver;
  resolver.getRoutes = () => routes;
  return resolver;
}

/** Waits for microtasks queued by the constructor warm-up to settle. */
const settle = () => new Promise(resolve => setImmediate(resolve));

describe('Mastra channels resolver', () => {
  describe('static channels record (existing behavior)', () => {
    it('attaches providers and mounts their routes at construction', () => {
      const slack = fakeProvider('slack');
      const mastra = new Mastra({ logger: false, channels: { slack } });

      expect(slack.__attach).toHaveBeenCalledWith(mastra);
      expect(mastra.getServer()?.apiRoutes).toEqual([
        expect.objectContaining({ path: '/slack/webhook', method: 'POST' }),
      ]);
      expect(mastra.getChannelProvider('slack')).toBe(slack);
    });

    it('resolveChannels() returns the static record without needing a resolver', async () => {
      const slack = fakeProvider('slack');
      const mastra = new Mastra({ logger: false, channels: { slack } });

      await expect(mastra.resolveChannels()).resolves.toEqual({ slack });
    });

    it('resolveChannels() returns an empty map when no channels are configured', async () => {
      const mastra = new Mastra({ logger: false });

      await expect(mastra.resolveChannels()).resolves.toEqual({});
    });
  });

  describe('channels resolver', () => {
    it('mounts resolver routes at construction, before any resolution', () => {
      const routes: ApiRoute[] = [
        { path: '/slack/events/:webhookId', method: 'POST', handler: async (c: any) => c.text('ok') },
        { path: '/telegram/webhook/:webhookId', method: 'POST', handler: async (c: any) => c.text('ok') },
      ];
      // Never resolves — routes must not depend on resolution.
      const resolver = fakeResolver(() => new Promise(() => {}), routes);

      const mastra = new Mastra({ logger: false, channels: resolver });

      expect(mastra.getServer()?.apiRoutes).toEqual(routes);
    });

    it('warms the first resolution in the background at construction', async () => {
      const slack = fakeProvider('slack');
      const resolve = vi.fn(async () => ({ slack }));
      const mastra = new Mastra({ logger: false, channels: fakeResolver(resolve) });

      await settle();

      expect(resolve).toHaveBeenCalled();
      expect(mastra.getChannelProvider('slack')).toBe(slack);
      expect(slack.__attach).toHaveBeenCalledWith(mastra);
      expect(slack.initialize).toHaveBeenCalledTimes(1);
    });

    it('survives a failing warm-up and retries on the next resolveChannels()', async () => {
      const slack = fakeProvider('slack');
      const resolve = vi
        .fn<() => Promise<Record<string, ChannelProvider>>>()
        .mockRejectedValueOnce(new Error('platform down'))
        .mockResolvedValue({ slack });

      const mastra = new Mastra({ logger: false, channels: fakeResolver(resolve) });
      await settle();

      expect(mastra.getChannelProviders()).toBeUndefined();
      await expect(mastra.resolveChannels()).resolves.toEqual({ slack });
      expect(mastra.getChannelProvider('slack')).toBe(slack);
    });

    it('attaches and initializes each provider instance exactly once across resolutions', async () => {
      const slack = fakeProvider('slack');
      const resolve = vi.fn(async () => ({ slack }));
      const mastra = new Mastra({ logger: false, channels: fakeResolver(resolve) });
      await settle();

      await mastra.resolveChannels();
      await mastra.resolveChannels();

      expect(slack.__attach).toHaveBeenCalledTimes(1);
      expect(slack.initialize).toHaveBeenCalledTimes(1);
    });

    it('picks up providers added by a later resolution and updates the snapshot', async () => {
      const slack = fakeProvider('slack');
      const telegram = fakeProvider('telegram');
      let providers: Record<string, ChannelProvider> = { slack };
      const mastra = new Mastra({ logger: false, channels: fakeResolver(async () => providers) });
      await settle();

      expect(mastra.getChannelProviders()).toEqual({ slack });

      providers = { slack, telegram };
      await expect(mastra.resolveChannels()).resolves.toEqual({ slack, telegram });

      expect(mastra.getChannelProvider('telegram')).toBe(telegram);
      expect(telegram.__attach).toHaveBeenCalledTimes(1);
      expect(telegram.initialize).toHaveBeenCalledTimes(1);
      // Pre-existing instance untouched.
      expect(slack.__attach).toHaveBeenCalledTimes(1);
    });

    it('drops providers removed by a later resolution from the snapshot', async () => {
      const slack = fakeProvider('slack');
      let providers: Record<string, ChannelProvider> = { slack };
      const mastra = new Mastra({ logger: false, channels: fakeResolver(async () => providers) });
      await settle();

      providers = {};
      await expect(mastra.resolveChannels()).resolves.toEqual({});
      expect(mastra.getChannelProvider('slack')).toBeUndefined();
      expect(mastra.channels).toEqual({});
    });

    it('coalesces concurrent resolveChannels() calls into one resolver invocation', async () => {
      const slack = fakeProvider('slack');
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      const resolve = vi.fn(async () => {
        await gate;
        return { slack };
      });
      const mastra = new Mastra({ logger: false, channels: fakeResolver(resolve) });
      // The warm-up call is in flight; these must join it.
      const [a, b] = [mastra.resolveChannels(), mastra.resolveChannels()];
      release();

      await expect(a).resolves.toEqual({ slack });
      await expect(b).resolves.toEqual({ slack });
      expect(resolve).toHaveBeenCalledTimes(1);
    });

    it('invokes the resolver with the Mastra instance as context', async () => {
      const resolve = vi.fn(async (_context?: { mastra?: unknown }) => ({}));
      const resolver = ((context?: { mastra?: unknown }) => resolve(context)) as unknown as ChannelsResolver;
      resolver.getRoutes = () => [];
      const mastra = new Mastra({ logger: false, channels: resolver });
      await settle();

      expect(resolve).toHaveBeenCalledWith({ mastra });
    });
  });
});
