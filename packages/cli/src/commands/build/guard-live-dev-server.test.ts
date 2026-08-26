import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const readLiveDevLock = vi.hoisted(() => vi.fn());

vi.mock('../dev/dev-lock', () => ({
  readLiveDevLock,
}));

import { guardAgainstLiveDevServer } from './guard-live-dev-server';

describe('guardAgainstLiveDevServer', () => {
  const originalExit = process.exit;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  beforeEach(() => {
    vi.clearAllMocks();
    process.exit = vi.fn() as any;
    console.error = vi.fn();
    console.warn = vi.fn();
  });

  afterEach(() => {
    process.exit = originalExit;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  it('does nothing when no dev server is live', async () => {
    readLiveDevLock.mockResolvedValue(null);

    await guardAgainstLiveDevServer('/some/.mastra', undefined);

    expect(process.exit).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('exits with an error when a dev server is live and --force was not passed', async () => {
    readLiveDevLock.mockResolvedValue({ pid: 4242, host: 'localhost', port: 4111 });

    await guardAgainstLiveDevServer('/some/.mastra', undefined);

    expect(process.exit).toHaveBeenCalledWith(1);
    const printed = (console.error as any).mock.calls.flat().join('\n');
    expect(printed).toContain('4242');
    expect(printed).toContain('--force');
  });

  it('warns but proceeds (no exit) when a dev server is live and --force was passed', async () => {
    readLiveDevLock.mockResolvedValue({ pid: 4242, host: 'localhost', port: 4111 });

    await guardAgainstLiveDevServer('/some/.mastra', true);

    expect(process.exit).not.toHaveBeenCalled();
    const printed = (console.warn as any).mock.calls.flat().join('\n');
    expect(printed).toContain('4242');
  });

  it('checks the exact output directory it was given', async () => {
    readLiveDevLock.mockResolvedValue(null);

    await guardAgainstLiveDevServer('/some/.mastra', undefined);

    expect(readLiveDevLock).toHaveBeenCalledWith('/some/.mastra');
  });
});
