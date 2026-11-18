import { describe, expect, it, vi } from 'vitest';

const loaded = vi.hoisted(() => ({ computer: 0 }));

// An @mastra/core without the computer accessibility part. The computer module itself would load
// (as in a CommonJS build, where the missing export is just `undefined`), so the check must come first.
vi.mock('@mastra/core/workspace', () => ({}));
vi.mock('./computer.js', () => {
  loaded.computer++;
  return {};
});

describe('computer on an older @mastra/core', () => {
  it('fails at the first computer call, naming the @mastra/core version it needs', async () => {
    const { createLazyPlatformComputer, COMPUTER_MIN_CORE_VERSION } = await import('./computer-loader.js');
    const computer = createLazyPlatformComputer(
      { exec: vi.fn(), viewerUrl: async () => null, template: 'builder' },
      vi.fn(),
    );
    await expect(computer.screenshot()).rejects.toThrow(`needs @mastra/core ${COMPUTER_MIN_CORE_VERSION} or later`);
    await expect(computer.accessibility!.getTree()).rejects.toThrow(`needs @mastra/core ${COMPUTER_MIN_CORE_VERSION}`);
    expect(loaded.computer).toBe(0);
  });
});
