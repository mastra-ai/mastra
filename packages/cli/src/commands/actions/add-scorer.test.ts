/**
 * Unit tests for the addScorer function
 *
 * These tests verify that the addScorer function properly:
 * - Calls analytics tracking with correct parameters
 * - Forwards arguments to the addNewScorer function
 * - Handles errors appropriately
 * - Respects environment configuration
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../..', () => ({
  analytics: {
    trackCommandExecution: vi.fn(),
  },
}));

vi.mock('../scorers/add-new-scorer', () => ({
  addNewScorer: vi.fn(),
}));

const mockAnalytics = {
  trackCommandExecution: vi.fn(),
};

const mockAddNewScorer = vi.fn();

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

describe('addScorer', () => {
  it('should execute addNewScorer with the provided scorer name', async () => {
    const { analytics } = await import('../..');
    const { addNewScorer } = await import('../scorers/add-new-scorer');
    const { addScorer } = await import('./add-scorer');

    vi.mocked(analytics.trackCommandExecution).mockImplementation(mockAnalytics.trackCommandExecution);
    vi.mocked(addNewScorer).mockImplementation(mockAddNewScorer);

    const scorerName = 'answer-relevancy';
    const args = { verbose: true };

    await addScorer(scorerName, args);

    expect(analytics.trackCommandExecution).toHaveBeenCalledWith({
      command: 'scorers-add',
      args: { verbose: true, scorerName: 'answer-relevancy' },
      execution: expect.any(Function),
      origin: undefined,
    });

    expect(addNewScorer).toHaveBeenCalledWith('answer-relevancy', undefined);
  });

  it('should handle undefined scorer name', async () => {
    const { analytics } = await import('../..');
    const { addNewScorer } = await import('../scorers/add-new-scorer');
    const { addScorer } = await import('./add-scorer');

    vi.mocked(analytics.trackCommandExecution).mockImplementation(mockAnalytics.trackCommandExecution);
    vi.mocked(addNewScorer).mockImplementation(mockAddNewScorer);

    const args = { interactive: true };

    await addScorer(undefined, args);

    expect(analytics.trackCommandExecution).toHaveBeenCalledWith({
      command: 'scorers-add',
      args: { interactive: true, scorerName: undefined },
      execution: expect.any(Function),
      origin: undefined,
    });

    expect(addNewScorer).toHaveBeenCalledWith(undefined, undefined);
  });

  it('should pass analytics origin from environment variable', async () => {
    process.env.MASTRA_ANALYTICS_ORIGIN = 'test-origin';

    // Re-import to get fresh module with new env var
    vi.resetModules();
    const { analytics } = await import('../..');
    const { addNewScorer } = await import('../scorers/add-new-scorer');
    const { addScorer } = await import('./add-scorer');

    vi.mocked(analytics.trackCommandExecution).mockImplementation(mockAnalytics.trackCommandExecution);
    vi.mocked(addNewScorer).mockImplementation(mockAddNewScorer);

    await addScorer('faithfulness', {});

    expect(analytics.trackCommandExecution).toHaveBeenCalledWith({
      command: 'scorers-add',
      args: { scorerName: 'faithfulness' },
      execution: expect.any(Function),
      origin: 'test-origin',
    });
  });

  it('should handle errors from addNewScorer gracefully', async () => {
    const { analytics } = await import('../..');
    const { addNewScorer } = await import('../scorers/add-new-scorer');
    const { addScorer } = await import('./add-scorer');

    const testError = new Error('Failed to add scorer');

    vi.mocked(analytics.trackCommandExecution).mockImplementation(async ({ execution }) => {
      await execution();
    });
    vi.mocked(addNewScorer).mockRejectedValue(testError);

    // Should propagate the error since there's no error handling in addScorer
    await expect(addScorer('hallucination', {})).rejects.toThrow('Failed to add scorer');
  });

  it('should handle analytics tracking errors gracefully', async () => {
    const { analytics } = await import('../..');
    const { addScorer } = await import('./add-scorer');

    const analyticsError = new Error('Analytics tracking failed');
    vi.mocked(analytics.trackCommandExecution).mockRejectedValue(analyticsError);

    // Should propagate the error since there's no error handling in addScorer
    await expect(addScorer('completeness', { debug: true })).rejects.toThrow('Analytics tracking failed');
  });

  it('should merge scorer name into args correctly', async () => {
    const { analytics } = await import('../..');
    const { addNewScorer } = await import('../scorers/add-new-scorer');
    const { addScorer } = await import('./add-scorer');

    vi.mocked(analytics.trackCommandExecution).mockImplementation(mockAnalytics.trackCommandExecution);
    vi.mocked(addNewScorer).mockImplementation(mockAddNewScorer);

    const args = { customPath: 'src/scorers', force: true, dir: '/custom/path' };
    const scorerName = 'content-similarity';

    await addScorer(scorerName, args);

    expect(analytics.trackCommandExecution).toHaveBeenCalledWith({
      command: 'scorers-add',
      args: {
        customPath: 'src/scorers',
        force: true,
        dir: '/custom/path',
        scorerName: 'content-similarity',
      },
      execution: expect.any(Function),
      origin: undefined,
    });

    expect(addNewScorer).toHaveBeenCalledWith('content-similarity', '/custom/path');
  });

  it('should handle empty args object', async () => {
    const { analytics } = await import('../..');
    const { addNewScorer } = await import('../scorers/add-new-scorer');
    const { addScorer } = await import('./add-scorer');

    vi.mocked(analytics.trackCommandExecution).mockImplementation(mockAnalytics.trackCommandExecution);
    vi.mocked(addNewScorer).mockImplementation(mockAddNewScorer);

    await addScorer('textual-difference', {});

    expect(analytics.trackCommandExecution).toHaveBeenCalledWith({
      command: 'scorers-add',
      args: { scorerName: 'textual-difference' },
      execution: expect.any(Function),
      origin: undefined,
    });

    expect(addNewScorer).toHaveBeenCalledWith('textual-difference', undefined);
  });

  it('should execute the analytics tracking execution function', async () => {
    const { analytics } = await import('../..');
    const { addNewScorer } = await import('../scorers/add-new-scorer');
    const { addScorer } = await import('./add-scorer');

    let executionFunctionCalled = false;

    vi.mocked(analytics.trackCommandExecution).mockImplementation(async ({ execution }) => {
      executionFunctionCalled = true;
      await execution();
    });
    vi.mocked(addNewScorer).mockImplementation(mockAddNewScorer);

    await addScorer('tone-consistency', {});

    expect(executionFunctionCalled).toBe(true);
    expect(addNewScorer).toHaveBeenCalledWith('tone-consistency', undefined);
  });
});
