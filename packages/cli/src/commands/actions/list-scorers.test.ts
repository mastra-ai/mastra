/**
 * Unit tests for the listScorers function
 *
 * These tests verify that the listScorers function properly:
 * - Calls analytics tracking with correct parameters
 * - Forwards execution to the listAllScorers function
 * - Handles different argument types gracefully
 * - Respects environment configuration
 * - Propagates errors appropriately
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../..', () => ({
  analytics: {
    trackCommandExecution: vi.fn(),
  },
}));

vi.mock('../scorers/list-all-scorers', () => ({
  listAllScorers: vi.fn(),
}));

const mockAnalytics = {
  trackCommandExecution: vi.fn(),
};

const mockListAllScorers = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
  delete process.env.MASTRA_ANALYTICS_ORIGIN;
  // Setup default mock implementations
  mockAnalytics.trackCommandExecution.mockImplementation(async ({ execution }) => {
    await execution();
  });
});

afterEach(() => {
  delete process.env.MASTRA_ANALYTICS_ORIGIN;
  vi.resetModules();
});

describe('listScorers', () => {
  it('should execute listAllScorers with analytics tracking', async () => {
    const { analytics } = await import('../..');
    const { listAllScorers } = await import('../scorers/list-all-scorers');
    const { listScorers } = await import('./list-scorers');

    vi.mocked(analytics.trackCommandExecution).mockImplementation(mockAnalytics.trackCommandExecution);
    vi.mocked(listAllScorers).mockImplementation(mockListAllScorers);

    const args = { format: 'table' };

    await listScorers(args);

    expect(analytics.trackCommandExecution).toHaveBeenCalledWith({
      command: 'scorers-list',
      args: { format: 'table' },
      execution: expect.any(Function),
      origin: undefined,
    });

    expect(listAllScorers).toHaveBeenCalledWith();
  });

  it('should handle empty args object', async () => {
    const { analytics } = await import('../..');
    const { listAllScorers } = await import('../scorers/list-all-scorers');
    const { listScorers } = await import('./list-scorers');

    vi.mocked(analytics.trackCommandExecution).mockImplementation(mockAnalytics.trackCommandExecution);
    vi.mocked(listAllScorers).mockImplementation(mockListAllScorers);

    await listScorers({});

    expect(analytics.trackCommandExecution).toHaveBeenCalledWith({
      command: 'scorers-list',
      args: {},
      execution: expect.any(Function),
      origin: undefined,
    });

    expect(listAllScorers).toHaveBeenCalledWith();
  });

  it('should pass analytics origin from environment variable', async () => {
    process.env.MASTRA_ANALYTICS_ORIGIN = 'production';

    // Re-import to get fresh module with new env var
    vi.resetModules();
    const { analytics } = await import('../..');
    const { listAllScorers } = await import('../scorers/list-all-scorers');
    const { listScorers } = await import('./list-scorers');

    vi.mocked(analytics.trackCommandExecution).mockImplementation(mockAnalytics.trackCommandExecution);
    vi.mocked(listAllScorers).mockImplementation(mockListAllScorers);

    await listScorers({ verbose: true });

    expect(analytics.trackCommandExecution).toHaveBeenCalledWith({
      command: 'scorers-list',
      args: { verbose: true },
      execution: expect.any(Function),
      origin: 'production',
    });
  });

  it('should execute the analytics tracking execution function', async () => {
    const { analytics } = await import('../..');
    const { listAllScorers } = await import('../scorers/list-all-scorers');
    const { listScorers } = await import('./list-scorers');

    let executionFunctionCalled = false;

    vi.mocked(analytics.trackCommandExecution).mockImplementation(async ({ execution }) => {
      executionFunctionCalled = true;
      await execution();
    });
    vi.mocked(listAllScorers).mockImplementation(mockListAllScorers);

    await listScorers({ json: true });

    expect(executionFunctionCalled).toBe(true);
    expect(listAllScorers).toHaveBeenCalledWith();
  });

  it('should handle complex args object with multiple properties', async () => {
    const { analytics } = await import('../..');
    const { listAllScorers } = await import('../scorers/list-all-scorers');
    const { listScorers } = await import('./list-scorers');

    vi.mocked(analytics.trackCommandExecution).mockImplementation(mockAnalytics.trackCommandExecution);
    vi.mocked(listAllScorers).mockImplementation(mockListAllScorers);

    const complexArgs = {
      category: 'accuracy-and-reliability',
      format: 'json',
      verbose: true,
      sort: 'name',
      filter: 'available',
    };

    await listScorers(complexArgs);

    expect(analytics.trackCommandExecution).toHaveBeenCalledWith({
      command: 'scorers-list',
      args: complexArgs,
      execution: expect.any(Function),
      origin: undefined,
    });

    expect(listAllScorers).toHaveBeenCalledWith();
  });

  it('should handle listAllScorers throwing an error', async () => {
    const { analytics } = await import('../..');
    const { listAllScorers } = await import('../scorers/list-all-scorers');
    const { listScorers } = await import('./list-scorers');

    const testError = new Error('Failed to list scorers');

    vi.mocked(analytics.trackCommandExecution).mockImplementation(async ({ execution }) => {
      await execution();
    });
    vi.mocked(listAllScorers).mockRejectedValue(testError);

    // Should propagate the error since there's no try-catch in listScorers
    await expect(listScorers({})).rejects.toThrow('Failed to list scorers');

    expect(listAllScorers).toHaveBeenCalledWith();
  });

  it('should handle analytics tracking errors', async () => {
    const { analytics } = await import('../..');
    const { listScorers } = await import('./list-scorers');

    const analyticsError = new Error('Analytics service unavailable');
    vi.mocked(analytics.trackCommandExecution).mockRejectedValue(analyticsError);

    // Should propagate the error since there's no try-catch in listScorers
    await expect(listScorers({ debug: true })).rejects.toThrow('Analytics service unavailable');
  });

  it('should not modify the original args object', async () => {
    const { analytics } = await import('../..');
    const { listAllScorers } = await import('../scorers/list-all-scorers');
    const { listScorers } = await import('./list-scorers');

    vi.mocked(analytics.trackCommandExecution).mockImplementation(mockAnalytics.trackCommandExecution);
    vi.mocked(listAllScorers).mockImplementation(mockListAllScorers);

    const originalArgs = { readonly: true };
    const originalArgsCopy = { ...originalArgs };

    await listScorers(originalArgs);

    // Ensure original args object wasn't modified
    expect(originalArgs).toEqual(originalArgsCopy);
  });

  it('should handle null and undefined args', async () => {
    const { analytics } = await import('../..');
    const { listAllScorers } = await import('../scorers/list-all-scorers');
    const { listScorers } = await import('./list-scorers');

    vi.mocked(analytics.trackCommandExecution).mockImplementation(mockAnalytics.trackCommandExecution);
    vi.mocked(listAllScorers).mockImplementation(mockListAllScorers);

    // Test with null
    await listScorers(null);
    expect(analytics.trackCommandExecution).toHaveBeenCalledWith({
      command: 'scorers-list',
      args: null,
      execution: expect.any(Function),
      origin: undefined,
    });

    vi.resetAllMocks();

    // Test with undefined
    await listScorers(undefined);
    expect(analytics.trackCommandExecution).toHaveBeenCalledWith({
      command: 'scorers-list',
      args: undefined,
      execution: expect.any(Function),
      origin: undefined,
    });
  });

  it('should handle different environment variable values', async () => {
    // Test with CLI_ORIGIN type
    process.env.MASTRA_ANALYTICS_ORIGIN = 'cli';

    vi.resetModules();
    const { analytics } = await import('../..');
    const { listAllScorers } = await import('../scorers/list-all-scorers');
    const { listScorers } = await import('./list-scorers');

    vi.mocked(analytics.trackCommandExecution).mockImplementation(mockAnalytics.trackCommandExecution);
    vi.mocked(listAllScorers).mockImplementation(mockListAllScorers);

    await listScorers({});

    expect(analytics.trackCommandExecution).toHaveBeenCalledWith({
      command: 'scorers-list',
      args: {},
      execution: expect.any(Function),
      origin: 'cli',
    });
  });

  it('should always call listAllScorers without any arguments', async () => {
    const { analytics } = await import('../..');
    const { listAllScorers } = await import('../scorers/list-all-scorers');
    const { listScorers } = await import('./list-scorers');

    vi.mocked(analytics.trackCommandExecution).mockImplementation(mockAnalytics.trackCommandExecution);
    vi.mocked(listAllScorers).mockImplementation(mockListAllScorers);

    // Even with complex args, listAllScorers should be called with no arguments
    await listScorers({
      category: 'output-quality',
      detailed: true,
      includeMetadata: true,
    });

    expect(listAllScorers).toHaveBeenCalledWith();
    expect(listAllScorers).toHaveBeenCalledTimes(1);

    // Verify it was called with no arguments
    const callArgs = vi.mocked(listAllScorers).mock.calls[0];
    expect(callArgs).toEqual([]);
  });
});
