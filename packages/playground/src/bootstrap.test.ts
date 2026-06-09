// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('./main');
  vi.doUnmock('./startup-error');
  vi.restoreAllMocks();
});

describe('bootstrap', () => {
  it('preserves startup errors in the console before rendering the fallback', async () => {
    const startupError = new Error('broken startup import');
    const renderStartupError = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.doMock('./main', () => ({
      startStudio: () => {
        throw startupError;
      },
    }));
    vi.doMock('./startup-error', () => ({ renderStartupError }));

    await import('./bootstrap');

    expect(consoleError).toHaveBeenCalledWith('Mastra Studio failed to start', startupError);
    expect(renderStartupError).toHaveBeenCalledWith(startupError);
  });
});
