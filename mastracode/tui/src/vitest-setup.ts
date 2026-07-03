import { vi } from 'vitest';

// Global mock for @mastra/github-signals — the package resolves to dist/ which
// is unavailable during unit tests.  Every test file that transitively imports
// @internal/mastracode (which conditionally imports the package) needs this.
vi.mock('@mastra/github-signals', () => ({
  GithubSignals: class GithubSignals {
    static signals = {
      subscribeToPR: vi.fn(),
      unsubscribeFromPR: vi.fn(),
    };
    id = 'github-signals';
    name = 'GitHub Signals';
    isConnected = false;
    addAgent() {}
    connect() {
      this.isConnected = true;
    }
    startPolling() {}
    stopAllPolling() {}
    onSubscriptionsChanged() {}
    onPollingChanged() {}
    isPollingThread() {
      return false;
    }
    isPollingThreadRunning() {
      return false;
    }
    startPollingForThread() {
      return Promise.resolve(true);
    }
    getInputProcessors() {
      return [{ id: 'github-signals', processInput: vi.fn() }];
    }
    getOutputProcessors() {
      return [];
    }
    getTools() {
      return {};
    }
    start() {}
    __registerMastra() {}
  },
  GITHUB_SUBSCRIBE_PR_TAG: 'github-subscribe-pr',
  GITHUB_UNSUBSCRIBE_PR_TAG: 'github-unsubscribe-pr',
  GITHUB_SYNC_STATUS_TAG: 'github-sync-status',
  GITHUB_SIGNALS_METADATA_KEY: 'githubSignals',
  normalizeGithubChecksForSnapshot: vi.fn(() => ({ checks: [] })),
}));
