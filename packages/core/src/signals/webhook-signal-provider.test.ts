import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SignalProviderTarget } from './signal-provider';
import { WebhookSignalProvider } from './webhook-signal-provider';

const target1: SignalProviderTarget = { threadId: 'thread-1', resourceId: 'user-1' };
const target2: SignalProviderTarget = { threadId: 'thread-2', resourceId: 'user-1' };

describe('WebhookSignalProvider', () => {
  let provider: WebhookSignalProvider;
  let mockAgent: { sendNotificationSignal: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockAgent = {
      sendNotificationSignal: vi.fn().mockResolvedValue(undefined),
    };
    provider = new WebhookSignalProvider();
    provider.connect(mockAgent as any);
  });

  afterEach(() => {
    provider.stop();
  });

  describe('constructor defaults', () => {
    it('uses default id and name', () => {
      expect(provider.id).toBe('webhook-signals');
      expect(provider.name).toBe('Webhook Signals');
    });

    it('accepts custom id and name', () => {
      const custom = new WebhookSignalProvider({ id: 'my-hooks', name: 'My Hooks' });
      expect(custom.id).toBe('my-hooks');
      expect(custom.name).toBe('My Hooks');
      custom.stop();
    });
  });

  describe('subscribeThread / unsubscribeThread', () => {
    it('creates and removes subscriptions', () => {
      const sub = provider.subscribeThread(target1, 'my-org/my-repo');
      expect(sub.threadId).toBe('thread-1');
      expect(sub.externalResourceId).toBe('my-org/my-repo');

      const removed = provider.unsubscribeThread(target1, 'my-org/my-repo');
      expect(removed).toBe(true);
    });

    it('returns false when unsubscribing non-existent', () => {
      expect(provider.unsubscribeThread(target1, 'nonexistent')).toBe(false);
    });
  });

  describe('handleWebhook', () => {
    it('matches payload to subscriptions via default resource extraction', async () => {
      provider.subscribeThread(target1, 'my-org/my-repo');

      const result = await provider.handleWebhook({
        body: { resource: 'my-org/my-repo', event: 'push' },
        headers: {},
      });

      expect(result.status).toBe(200);
      expect(result.body).toEqual({ matched: 1 });
      expect(mockAgent.sendNotificationSignal).toHaveBeenCalledTimes(1);
      expect(mockAgent.sendNotificationSignal).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'webhook-signals',
          kind: 'webhook-event',
          summary: 'Webhook event for my-org/my-repo',
        }),
        { resourceId: 'user-1', threadId: 'thread-1' },
      );
    });

    it('matches via externalResourceId field in payload', async () => {
      provider.subscribeThread(target1, 'resource-x');

      const result = await provider.handleWebhook({
        body: { externalResourceId: 'resource-x' },
        headers: {},
      });

      expect(result.body).toEqual({ matched: 1 });
    });

    it('routes to multiple subscribed threads for same resource', async () => {
      provider.subscribeThread(target1, 'shared-resource');
      provider.subscribeThread(target2, 'shared-resource');

      const result = await provider.handleWebhook({
        body: { resource: 'shared-resource' },
        headers: {},
      });

      expect(result.body).toEqual({ matched: 2 });
      expect(mockAgent.sendNotificationSignal).toHaveBeenCalledTimes(2);
    });

    it('returns matched: 0 when no subscriptions match', async () => {
      provider.subscribeThread(target1, 'my-org/my-repo');

      const result = await provider.handleWebhook({
        body: { resource: 'other-org/other-repo' },
        headers: {},
      });

      expect(result.body).toEqual({ matched: 0 });
      expect(mockAgent.sendNotificationSignal).not.toHaveBeenCalled();
    });

    it('returns matched: 0 when payload has no extractable resource', async () => {
      provider.subscribeThread(target1, 'my-org/my-repo');

      const result = await provider.handleWebhook({
        body: { unrelated: 'data' },
        headers: {},
      });

      expect(result.body).toEqual({ matched: 0 });
    });

    it('continues on notify failure and logs warning', async () => {
      provider.subscribeThread(target1, 'res-a');
      provider.subscribeThread(target2, 'res-a');
      mockAgent.sendNotificationSignal
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce(undefined);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await provider.handleWebhook({
        body: { resource: 'res-a' },
        headers: {},
      });

      expect(result.body).toEqual({ matched: 1 });
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('custom extractResourceId', () => {
    it('uses custom extractor', async () => {
      const custom = new WebhookSignalProvider({
        extractResourceId: payload => (payload as any).repo?.fullName,
      });
      custom.connect(mockAgent as any);
      custom.subscribeThread(target1, 'acme/widget');

      const result = await custom.handleWebhook({
        body: { repo: { fullName: 'acme/widget' } },
        headers: {},
      });

      expect(result.body).toEqual({ matched: 1 });
      custom.stop();
    });

    it('supports returning multiple resource ids', async () => {
      const custom = new WebhookSignalProvider({
        extractResourceId: payload => (payload as any).repositories,
      });
      custom.connect(mockAgent as any);
      custom.subscribeThread(target1, 'repo-a');
      custom.subscribeThread(target2, 'repo-b');

      const result = await custom.handleWebhook({
        body: { repositories: ['repo-a', 'repo-b'] },
        headers: {},
      });

      expect(result.body).toEqual({ matched: 2 });
      custom.stop();
    });

    it('handles extractor returning undefined', async () => {
      const custom = new WebhookSignalProvider({
        extractResourceId: () => undefined,
      });
      custom.connect(mockAgent as any);
      custom.subscribeThread(target1, 'res');

      const result = await custom.handleWebhook({
        body: {},
        headers: {},
      });

      expect(result.body).toEqual({ matched: 0 });
      custom.stop();
    });
  });

  describe('custom buildNotification', () => {
    it('uses custom notification builder', async () => {
      const custom = new WebhookSignalProvider({
        buildNotification: (payload, sub) => ({
          source: 'ci',
          kind: 'build-failed',
          summary: `Build failed for ${sub.externalResourceId}`,
          priority: 'high',
          payload,
        }),
      });
      custom.connect(mockAgent as any);
      custom.subscribeThread(target1, 'my-repo');

      await custom.handleWebhook({
        body: { resource: 'my-repo', status: 'failed' },
        headers: {},
      });

      expect(mockAgent.sendNotificationSignal).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'ci',
          kind: 'build-failed',
          summary: 'Build failed for my-repo',
          priority: 'high',
        }),
        { resourceId: 'user-1', threadId: 'thread-1' },
      );
      custom.stop();
    });
  });

  describe('static signals', () => {
    it('subscribe creates a reactive signal', () => {
      const signal = WebhookSignalProvider.signals.subscribe('my-resource');
      expect(signal.type).toBe('reactive');
      expect(signal.tagName).toBe('webhook-subscribe');
      expect(signal.attributes.resource).toBe('my-resource');
    });

    it('unsubscribe creates a reactive signal', () => {
      const signal = WebhookSignalProvider.signals.unsubscribe('my-resource');
      expect(signal.type).toBe('reactive');
      expect(signal.tagName).toBe('webhook-unsubscribe');
      expect(signal.attributes.resource).toBe('my-resource');
    });
  });

  describe('lifecycle', () => {
    it('stop() clears all subscriptions', () => {
      const first = provider.subscribeThread(target1, 'res-a');
      provider.subscribeThread(target2, 'res-b');
      provider.stop();
      const recreated = provider.subscribeThread(target1, 'res-a');
      expect(recreated.id).not.toBe(first.id);
    });
  });
});
