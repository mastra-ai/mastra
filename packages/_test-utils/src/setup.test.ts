import { afterEach, describe, expect, it, vi } from 'vitest';
import './setup';

const firstUUID = '00000000-0000-4000-8000-000000000001';
const secondUUID = '00000000-0000-4000-8000-000000000002';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('deterministic Web Crypto test setup', () => {
  it('provides deterministic UUIDs before mocks are restored', () => {
    expect(globalThis.crypto.randomUUID()).toBe(firstUUID);
  });

  it('reinstalls the UUID spy after a previous test restores all mocks', () => {
    expect(globalThis.crypto.randomUUID()).toBe(firstUUID);
  });

  describe.concurrent('concurrent isolation', () => {
    let ready = 0;
    let release: (() => void) | undefined;
    const barrier = new Promise<void>(resolve => {
      release = resolve;
    });

    async function waitForBoth() {
      ready++;
      if (ready === 2) release?.();
      await barrier;
    }

    it('isolates the first concurrent test UUID sequence', async () => {
      expect(globalThis.crypto.randomUUID()).toBe(firstUUID);
      await waitForBoth();
      expect(globalThis.crypto.randomUUID()).toBe(secondUUID);
    });

    it('isolates the second concurrent test UUID sequence', async () => {
      expect(globalThis.crypto.randomUUID()).toBe(firstUUID);
      await waitForBoth();
      expect(globalThis.crypto.randomUUID()).toBe(secondUUID);
    });
  });
});
