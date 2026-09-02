import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const readLiveDevLock = vi.hoisted(() => vi.fn());

vi.mock('../dev/dev-lock', () => ({
  readLiveDevLock,
}));

import { guardAgainstLiveDevServer, prepareWithLiveDevGuard } from './guard-live-dev-server';

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

describe('prepareWithLiveDevGuard', () => {
  const originalExit = process.exit;
  const originalConsoleError = console.error;

  beforeEach(() => {
    vi.clearAllMocks();
    process.exit = vi.fn() as any;
    console.error = vi.fn();
    console.warn = vi.fn();
  });

  afterEach(() => {
    process.exit = originalExit;
    console.error = originalConsoleError;
  });

  it('runs prepare() when no dev server is live', async () => {
    readLiveDevLock.mockResolvedValue(null);
    const prepare = vi.fn().mockResolvedValue(undefined);

    await prepareWithLiveDevGuard('/some/.mastra', undefined, prepare);

    expect(prepare).toHaveBeenCalledTimes(1);
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('does not run prepare() when a dev server started after an earlier guard check passed', async () => {
    // Models the interleaving this exists to guard against: build()'s
    // up-front guardAgainstLiveDevServer() check (elsewhere) sees no lock and
    // proceeds into its async pre-build work; a `mastra dev` starts and
    // acquires the lock during that window; by the time build() reaches the
    // actual prepare() call, the lock is live.
    readLiveDevLock
      .mockResolvedValueOnce(null) // build()'s earlier, one-time guard check
      .mockResolvedValueOnce({ pid: 777, host: 'localhost', port: 4111 }); // dev started in between
    const prepare = vi.fn().mockResolvedValue(undefined);

    await guardAgainstLiveDevServer('/some/.mastra', undefined); // the earlier check: passes
    expect(process.exit).not.toHaveBeenCalled();

    await prepareWithLiveDevGuard('/some/.mastra', undefined, prepare); // the guarded call site

    expect(prepare).not.toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
    const printed = (console.error as any).mock.calls.flat().join('\n');
    expect(printed).toContain('777');
  });

  it('still runs prepare() when a live dev server is present but --force was passed', async () => {
    readLiveDevLock.mockResolvedValue({ pid: 777, host: 'localhost', port: 4111 });
    const prepare = vi.fn().mockResolvedValue(undefined);

    await prepareWithLiveDevGuard('/some/.mastra', true, prepare);

    expect(prepare).toHaveBeenCalledTimes(1);
    expect(process.exit).not.toHaveBeenCalled();
  });
});
