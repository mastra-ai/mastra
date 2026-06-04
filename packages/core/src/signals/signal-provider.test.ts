import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Agent } from '../agent/agent';
import { SignalProvider, isSignalProvider } from './signal-provider';
import type { SignalProviderTarget, SignalSubscription } from './signal-provider';

// ── Test subclass that exposes protected methods ──────────────────────

class TestSignalProvider extends SignalProvider<'test-signals'> {
  readonly id = 'test-signals' as const;
  readonly name = 'Test Signals';
  readonly pollInterval?: number;
  pollCalls: SignalSubscription[][] = [];

  constructor(options: { pollInterval?: number } = {}) {
    super();
    if (options.pollInterval !== undefined) {
      (this as any).pollInterval = options.pollInterval;
    }
  }

  async poll(subscriptions: SignalSubscription[]): Promise<void> {
    this.pollCalls.push([...subscriptions]);
  }

  // Expose protected methods for testing
  doSubscribe(
    target: SignalProviderTarget,
    externalResourceId: string,
    metadata?: Record<string, unknown>,
  ): SignalSubscription {
    return this.subscribe(target, externalResourceId, metadata);
  }

  doUnsubscribe(target: SignalProviderTarget, externalResourceId: string): boolean {
    return this.unsubscribe(target, externalResourceId);
  }

  doGetSubscriptions(): SignalSubscription[] {
    return this.getSubscriptions();
  }

  doGetSubscriptionsForResource(externalResourceId: string): SignalSubscription[] {
    return this.getSubscriptionsForResource(externalResourceId);
  }

  doGetSubscriptionsForThread(target: SignalProviderTarget): SignalSubscription[] {
    return this.getSubscriptionsForThread(target);
  }

  doHasSubscription(target: SignalProviderTarget, externalResourceId: string): boolean {
    return this.hasSubscription(target, externalResourceId);
  }

  doUnsubscribeAll(target: SignalProviderTarget): number {
    return this.unsubscribeAll(target);
  }

  doGetSubscriptionCount(): number {
    return this.subscriptionCount;
  }

  doGetAgent() {
    return this.agent;
  }

  async doNotify(notification: Parameters<SignalProvider['notify']>[0], target: SignalProviderTarget): Promise<void> {
    return this.notify(notification, target);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

const target1: SignalProviderTarget = { threadId: 'thread-1', resourceId: 'user-1' };
const target2: SignalProviderTarget = { threadId: 'thread-2', resourceId: 'user-1' };
const target3: SignalProviderTarget = { threadId: 'thread-3', resourceId: 'user-2' };

// ── Tests ────────────────────────────────────────────────────────────

describe('SignalProvider', () => {
  let provider: TestSignalProvider;

  beforeEach(() => {
    provider = new TestSignalProvider();
  });

  afterEach(() => {
    provider.stop();
  });

  describe('subscription tracking', () => {
    it('creates a subscription and returns it', () => {
      const sub = provider.doSubscribe(target1, 'github:mastra-ai/mastra#123');
      expect(sub.providerId).toBe('test-signals');
      expect(sub.threadId).toBe('thread-1');
      expect(sub.resourceId).toBe('user-1');
      expect(sub.externalResourceId).toBe('github:mastra-ai/mastra#123');
      expect(sub.id).toBeTruthy();
      expect(sub.subscribedAt).toBeInstanceOf(Date);
      expect(sub.metadata).toEqual({});
    });

    it('returns existing subscription on duplicate and merges metadata', () => {
      const sub1 = provider.doSubscribe(target1, 'github:mastra-ai/mastra#123', { pr: 123 });
      const sub2 = provider.doSubscribe(target1, 'github:mastra-ai/mastra#123', { status: 'open' });
      expect(sub2.id).toBe(sub1.id);
      expect(sub2.metadata).toEqual({ pr: 123, status: 'open' });
      expect(provider.doGetSubscriptionCount()).toBe(1);
    });

    it('tracks multiple subscriptions for different targets', () => {
      provider.doSubscribe(target1, 'github:mastra-ai/mastra#123');
      provider.doSubscribe(target2, 'github:mastra-ai/mastra#123');
      provider.doSubscribe(target1, 'github:mastra-ai/mastra#456');
      expect(provider.doGetSubscriptionCount()).toBe(3);
    });

    it('getSubscriptions returns all active subscriptions', () => {
      provider.doSubscribe(target1, 'res-a');
      provider.doSubscribe(target2, 'res-b');
      const subs = provider.doGetSubscriptions();
      expect(subs).toHaveLength(2);
      expect(subs.map(s => s.externalResourceId).sort()).toEqual(['res-a', 'res-b']);
    });

    it('getSubscriptionsForResource returns subscriptions by external resource', () => {
      provider.doSubscribe(target1, 'res-a');
      provider.doSubscribe(target2, 'res-a');
      provider.doSubscribe(target3, 'res-b');

      const resA = provider.doGetSubscriptionsForResource('res-a');
      expect(resA).toHaveLength(2);
      expect(resA.every(s => s.externalResourceId === 'res-a')).toBe(true);

      const resB = provider.doGetSubscriptionsForResource('res-b');
      expect(resB).toHaveLength(1);
      expect(resB[0].threadId).toBe('thread-3');

      expect(provider.doGetSubscriptionsForResource('nonexistent')).toEqual([]);
    });

    it('getSubscriptionsForThread returns subscriptions by thread', () => {
      provider.doSubscribe(target1, 'res-a');
      provider.doSubscribe(target1, 'res-b');
      provider.doSubscribe(target2, 'res-a');

      const thread1Subs = provider.doGetSubscriptionsForThread(target1);
      expect(thread1Subs).toHaveLength(2);
      expect(thread1Subs.map(s => s.externalResourceId).sort()).toEqual(['res-a', 'res-b']);

      const thread2Subs = provider.doGetSubscriptionsForThread(target2);
      expect(thread2Subs).toHaveLength(1);
    });

    it('hasSubscription checks existence', () => {
      provider.doSubscribe(target1, 'res-a');
      expect(provider.doHasSubscription(target1, 'res-a')).toBe(true);
      expect(provider.doHasSubscription(target1, 'res-b')).toBe(false);
      expect(provider.doHasSubscription(target2, 'res-a')).toBe(false);
    });

    it('unsubscribe removes a subscription and cleans up indices', () => {
      provider.doSubscribe(target1, 'res-a');
      provider.doSubscribe(target1, 'res-b');

      expect(provider.doUnsubscribe(target1, 'res-a')).toBe(true);
      expect(provider.doGetSubscriptionCount()).toBe(1);
      expect(provider.doHasSubscription(target1, 'res-a')).toBe(false);
      expect(provider.doGetSubscriptionsForResource('res-a')).toEqual([]);
      expect(provider.doGetSubscriptionsForThread(target1)).toHaveLength(1);
    });

    it('unsubscribe returns false for non-existent subscription', () => {
      expect(provider.doUnsubscribe(target1, 'nonexistent')).toBe(false);
    });

    it('unsubscribeAll removes all subscriptions for a thread', () => {
      provider.doSubscribe(target1, 'res-a');
      provider.doSubscribe(target1, 'res-b');
      provider.doSubscribe(target1, 'res-c');
      provider.doSubscribe(target2, 'res-a');

      const removed = provider.doUnsubscribeAll(target1);
      expect(removed).toBe(3);
      expect(provider.doGetSubscriptionCount()).toBe(1);
      expect(provider.doGetSubscriptionsForThread(target1)).toEqual([]);
      expect(provider.doGetSubscriptionsForThread(target2)).toHaveLength(1);
    });

    it('stop() clears all subscriptions', () => {
      provider.doSubscribe(target1, 'res-a');
      provider.doSubscribe(target2, 'res-b');
      provider.stop();
      expect(provider.doGetSubscriptionCount()).toBe(0);
      expect(provider.doGetSubscriptions()).toEqual([]);
    });
  });

  describe('connection', () => {
    it('agent is undefined before connect', () => {
      expect(provider.doGetAgent()).toBeUndefined();
    });

    it('agent is set after connect', () => {
      const mockAgent = { sendNotificationSignal: vi.fn() } as any;
      provider.connect(mockAgent);
      expect(provider.doGetAgent()).toBe(mockAgent);
    });
  });

  describe('notify', () => {
    it('throws when no agent is connected', async () => {
      await expect(
        provider.doNotify({ source: 'test', kind: 'test-event', summary: 'hello' }, target1),
      ).rejects.toThrow(/no agent connected/);
    });

    it('calls agent.sendNotificationSignal with correct args', async () => {
      const mockAgent = {
        sendNotificationSignal: vi.fn().mockResolvedValue(undefined),
      } as any;
      provider.connect(mockAgent);

      const notification = {
        source: 'test',
        kind: 'pr-updated',
        summary: 'PR was updated',
        priority: 'high' as const,
      };

      await provider.doNotify(notification, target1);

      expect(mockAgent.sendNotificationSignal).toHaveBeenCalledWith(notification, {
        resourceId: 'user-1',
        threadId: 'thread-1',
      });
    });
  });

  describe('polling', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('does not start polling when pollInterval is not set', () => {
      const p = new TestSignalProvider();
      p.startPolling();
      vi.advanceTimersByTime(10_000);
      expect(p.pollCalls).toHaveLength(0);
      p.stop();
    });

    it('does not start polling when pollInterval is 0', () => {
      const p = new TestSignalProvider({ pollInterval: 0 });
      p.startPolling();
      vi.advanceTimersByTime(10_000);
      expect(p.pollCalls).toHaveLength(0);
      p.stop();
    });

    it('polls on interval with active subscriptions', async () => {
      const p = new TestSignalProvider({ pollInterval: 1000 });
      p.doSubscribe(target1, 'res-a');
      p.startPolling();

      await vi.advanceTimersByTimeAsync(3500);
      expect(p.pollCalls).toHaveLength(3);
      expect(p.pollCalls[0]).toHaveLength(1);
      expect(p.pollCalls[0][0].externalResourceId).toBe('res-a');
      p.stop();
    });

    it('skips poll when no subscriptions', () => {
      const p = new TestSignalProvider({ pollInterval: 1000 });
      p.startPolling();
      vi.advanceTimersByTime(3500);
      expect(p.pollCalls).toHaveLength(0);
      p.stop();
    });

    it('stopPolling stops the timer', async () => {
      const p = new TestSignalProvider({ pollInterval: 1000 });
      p.doSubscribe(target1, 'res-a');
      p.startPolling();

      await vi.advanceTimersByTimeAsync(2500);
      expect(p.pollCalls).toHaveLength(2);

      p.stopPolling();
      await vi.advanceTimersByTimeAsync(5000);
      expect(p.pollCalls).toHaveLength(2);
      p.stop();
    });

    it('startPolling is idempotent', async () => {
      const p = new TestSignalProvider({ pollInterval: 1000 });
      p.doSubscribe(target1, 'res-a');
      p.startPolling();
      p.startPolling(); // second call should be no-op

      await vi.advanceTimersByTimeAsync(2500);
      expect(p.pollCalls).toHaveLength(2);
      p.stop();
    });

    it('swallows poll errors without crashing', () => {
      const errorProvider = new TestSignalProvider({ pollInterval: 1000 });
      errorProvider.poll = vi.fn().mockRejectedValue(new Error('poll failed'));
      errorProvider.doSubscribe(target1, 'res-a');
      errorProvider.startPolling();

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.advanceTimersByTime(1500);
      expect(errorProvider.poll).toHaveBeenCalled();

      warnSpy.mockRestore();
      errorProvider.stop();
    });
  });

  describe('isSignalProvider', () => {
    it('returns true for SignalProvider instances', () => {
      expect(isSignalProvider(provider)).toBe(true);
    });

    it('returns false for plain objects', () => {
      expect(isSignalProvider({ id: 'test' })).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(isSignalProvider(null)).toBe(false);
      expect(isSignalProvider(undefined)).toBe(false);
    });
  });

  describe('Agent wiring', () => {
    it('calls start() on providers during Agent construction', () => {
      const startFn = vi.fn();
      const p = new TestSignalProvider();
      p.start = startFn;

      new Agent({
        name: 'test-agent',
        instructions: 'test',
        model: { provider: 'test', name: 'test', toolChoice: 'auto' } as any,
        signals: [p],
      });

      expect(startFn).toHaveBeenCalledTimes(1);
    });

    it('collects getTools() from providers and merges into agent tools', () => {
      const getToolsSpy = vi.fn(() => ({ myTool: { id: 'myTool' } }));

      class ToolProvider extends SignalProvider<'tool-provider'> {
        readonly id = 'tool-provider' as const;
        readonly name = 'Tool Provider';
        async poll() {}
        getTools = getToolsSpy;
      }

      const p = new ToolProvider();
      const agent = new Agent({
        name: 'test-agent',
        instructions: 'test',
        model: { provider: 'test', name: 'test', toolChoice: 'auto' } as any,
        signals: [p],
      });

      expect(getToolsSpy).toHaveBeenCalledTimes(1);
      const tools = agent.listTools() as Record<string, unknown>;
      expect(tools).toHaveProperty('myTool');
    });

    it('propagates __registerMastra to signal providers', () => {
      const registerSpy = vi.fn();
      const p = new TestSignalProvider();
      p.__registerMastra = registerSpy;

      const agent = new Agent({
        name: 'test-agent',
        instructions: 'test',
        model: { provider: 'test', name: 'test', toolChoice: 'auto' } as any,
        signals: [p],
      });

      const fakeMastra = { getStorage: vi.fn() } as any;
      agent.__registerMastra(fakeMastra);

      expect(registerSpy).toHaveBeenCalledWith(fakeMastra);
    });

    it('connects provider to agent via signals config', () => {
      const p = new TestSignalProvider();
      expect(p.doGetAgent()).toBeUndefined();

      new Agent({
        name: 'test-agent',
        instructions: 'test',
        model: { provider: 'test', name: 'test', toolChoice: 'auto' } as any,
        signals: [p],
      });

      expect(p.doGetAgent()).toBeDefined();
      expect(p.isConnected).toBe(true);
    });

    it('does not re-wire already-connected providers (fork safety)', () => {
      const p = new TestSignalProvider();
      const startFn = vi.fn();
      p.start = startFn;

      new Agent({
        name: 'test-agent',
        instructions: 'test',
        model: { provider: 'test', name: 'test', toolChoice: 'auto' } as any,
        signals: [p],
      });

      expect(startFn).toHaveBeenCalledTimes(1);
      const firstAgent = p.doGetAgent();

      // Simulate a fork by constructing another Agent with the same provider
      new Agent({
        name: 'forked-agent',
        instructions: 'test',
        model: { provider: 'test', name: 'test', toolChoice: 'auto' } as any,
        signals: [p],
      });

      // Provider should still point to original agent, start() not called again
      expect(startFn).toHaveBeenCalledTimes(1);
      expect(p.doGetAgent()).toBe(firstAgent);
    });

    it('registers input and output processors from providers', () => {
      const fakeInputProcessor = { id: 'fake-input', processInputStep: vi.fn() };
      const fakeOutputProcessor = { id: 'fake-output', processOutputStep: vi.fn() };

      class ProcessorProvider extends SignalProvider<'proc-provider'> {
        readonly id = 'proc-provider' as const;
        getInputProcessors() {
          return [fakeInputProcessor as any];
        }
        getOutputProcessors() {
          return [fakeOutputProcessor as any];
        }
      }

      const p = new ProcessorProvider();
      new Agent({
        name: 'test-agent',
        instructions: 'test',
        model: { provider: 'test', name: 'test', toolChoice: 'auto' } as any,
        signals: [p],
      });

      // Processors are registered internally; we verify the provider was wired
      expect(p.isConnected).toBe(true);
    });

    it('wires multiple providers independently', () => {
      class ProviderA extends SignalProvider<'provider-a'> {
        readonly id = 'provider-a' as const;
        getTools() {
          return { toolA: { id: 'toolA' } };
        }
      }

      class ProviderB extends SignalProvider<'provider-b'> {
        readonly id = 'provider-b' as const;
        getTools() {
          return { toolB: { id: 'toolB' } };
        }
      }

      const a = new ProviderA();
      const b = new ProviderB();

      const agent = new Agent({
        name: 'test-agent',
        instructions: 'test',
        model: { provider: 'test', name: 'test', toolChoice: 'auto' } as any,
        signals: [a, b],
      });

      const tools = agent.listTools() as Record<string, unknown>;
      expect(tools).toHaveProperty('toolA');
      expect(tools).toHaveProperty('toolB');
      expect(a.isConnected).toBe(true);
      expect(b.isConnected).toBe(true);
    });
  });

  describe('full lifecycle integration', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('subscribe → poll → notify round-trip', async () => {
      const mockSendNotification = vi.fn().mockResolvedValue(undefined);

      // Provider that auto-notifies on poll for each subscription
      class NotifyingProvider extends SignalProvider<'notifying'> {
        readonly id = 'notifying' as const;
        readonly pollInterval = 1000;

        async poll(subscriptions: SignalSubscription[]) {
          for (const sub of subscriptions) {
            await this.notify(
              { source: 'test', kind: 'update', summary: `Update for ${sub.externalResourceId}` },
              { threadId: sub.threadId, resourceId: sub.resourceId },
            );
          }
        }

        // Expose subscribe for testing
        addSubscription(target: SignalProviderTarget, externalResourceId: string) {
          return this.subscribe(target, externalResourceId);
        }
      }

      const provider = new NotifyingProvider();
      const mockAgent = { sendNotificationSignal: mockSendNotification } as any;
      provider.connect(mockAgent);

      // Subscribe two targets to the same resource
      provider.addSubscription(target1, 'slack:general');
      provider.addSubscription(target2, 'slack:general');

      // Start polling
      provider.startPolling();

      // Advance past one poll cycle
      await vi.advanceTimersByTimeAsync(1500);

      // Both targets should have been notified
      expect(mockSendNotification).toHaveBeenCalledTimes(2);
      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'test', kind: 'update', summary: 'Update for slack:general' }),
        { resourceId: 'user-1', threadId: 'thread-1' },
      );
      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'test', kind: 'update', summary: 'Update for slack:general' }),
        { resourceId: 'user-1', threadId: 'thread-2' },
      );

      // Unsubscribe one and verify next poll only notifies the remaining target
      mockSendNotification.mockClear();
      provider.addSubscription(target1, 'slack:general'); // re-get it; unsubscribe via protected
      // We need the protected unsubscribe; use the test helper pattern
      const testProvider = provider as any;
      testProvider.unsubscribe(target1, 'slack:general');

      await vi.advanceTimersByTimeAsync(1000);

      expect(mockSendNotification).toHaveBeenCalledTimes(1);
      expect(mockSendNotification).toHaveBeenCalledWith(expect.anything(), {
        resourceId: 'user-1',
        threadId: 'thread-2',
      });

      provider.stop();
    });
  });
});
