import { vi } from 'vitest';

// Global mock for @mastra/github-signals — the package resolves to dist/ which
// is unavailable during unit tests.  Every test file that transitively imports
// mastracode/src/index.ts (which conditionally imports the package) needs this.
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

// Global mock for @mastra/slack-signals — same rationale as the GitHub mock above.
vi.mock('@mastra/slack-signals', () => ({
  SlackSignals: class SlackSignals {
    static signals = {
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    id = 'slack-signals';
    name = 'Slack Signals';
    isConnected = false;
    pollInterval = 60_000;
    addAgent() {}
    connect() {
      this.isConnected = true;
    }
    disconnect() {}
    onSubscriptionsChanged() {}
    getInputProcessors() {
      return [{ id: 'slack-signals', processInput: vi.fn() }];
    }
    getOutputProcessors() {
      return [];
    }
    getTools() {
      return {};
    }
    start() {}
    stop() {}
    __registerMastra() {}
    startPollingForThread() {}
    stopPollingForThread() {}
    stopAllPolling() {}
    isPollingThread() {
      return false;
    }
    subscribeThreadToSlack = vi.fn(async () => ({ subscribed: true, workspaceId: 'T123', workspaceName: 'Test', subscription: { channels: {} } }));
    unsubscribeThreadFromSlack = vi.fn(async () => ({ removed: true, workspaceId: 'T123', workspaceName: 'Test' }));
    listAvailableChannels = vi.fn(async () => []);
  },
  SLACK_SIGNALS_PROVIDER_ID: 'slack-signals',
  SLACK_SIGNALS_METADATA_KEY: 'slackSignals',
  SLACK_SUBSCRIBE_TAG: 'slack-subscribe',
  SLACK_UNSUBSCRIBE_TAG: 'slack-unsubscribe',
  SLACK_SYNC_STATUS_TAG: 'slack-sync-status',
  getSlackSignalsMetadata: (raw: Record<string, unknown>) => {
    const mastra = raw?.mastra;
    if (!mastra || typeof mastra !== 'object') return {};
    const slackSignals = (mastra as Record<string, unknown>).slackSignals;
    if (!slackSignals || typeof slackSignals !== 'object') return {};
    const sub = (slackSignals as Record<string, unknown>).subscription;
    if (sub && typeof sub === 'object' && 'workspaceId' in sub && 'subscribedAt' in sub) {
      return { subscription: sub as Record<string, unknown> };
    }
    return {};
  },
}));