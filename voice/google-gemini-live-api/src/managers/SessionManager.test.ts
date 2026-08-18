import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessionManager } from './SessionManager';

describe('SessionManager', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('waitForSessionCreated', () => {
    it('clears the readiness timeout after setup completes', async () => {
      vi.useFakeTimers();
      const manager = new SessionManager({ debug: false, timeoutMs: 30_000 });

      const sessionCreated = manager.waitForSessionCreated();
      manager.getEventEmitter().emit('setupComplete');

      await expect(sessionCreated).resolves.toBeUndefined();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('clears the readiness timeout after setup fails', async () => {
      vi.useFakeTimers();
      const manager = new SessionManager({ debug: false, timeoutMs: 30_000 });

      const sessionCreated = manager.waitForSessionCreated();
      manager.getEventEmitter().emit('error', { message: 'connection failed' });

      await expect(sessionCreated).rejects.toThrow('Session creation failed: connection failed');
      expect(vi.getTimerCount()).toBe(0);
    });

    it('clears the readiness timeout when the session ends during setup', async () => {
      vi.useFakeTimers();
      const manager = new SessionManager({ debug: false, timeoutMs: 30_000 });

      const sessionCreated = manager.waitForSessionCreated();
      manager.getEventEmitter().emit('sessionEnd');

      await expect(sessionCreated).rejects.toThrow('Session ended before setup completed');
      expect(vi.getTimerCount()).toBe(0);
    });

    it('clears the readiness timeout after timing out', async () => {
      vi.useFakeTimers();
      const manager = new SessionManager({ debug: false, timeoutMs: 30_000 });

      const sessionCreated = manager.waitForSessionCreated();
      const expectation = expect(sessionCreated).rejects.toThrow('Session creation timeout');
      await vi.advanceTimersByTimeAsync(30_000);

      await expectation;
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
