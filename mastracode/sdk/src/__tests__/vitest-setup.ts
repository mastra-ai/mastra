import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, vi } from 'vitest';

// Settings, auth and the database resolve from MASTRA_APP_DATA_DIR. Point it at a
// fresh temp folder so a test whose mocks don't apply can never write the real
// Mastra Code app data.
const testAppDataDir = mkdtempSync(join(tmpdir(), 'mastracode-test-app-data-'));
process.env.MASTRA_APP_DATA_DIR = testAppDataDir;
afterAll(() => rmSync(testAppDataDir, { recursive: true, force: true }));

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
    options: unknown;
    constructor(options?: unknown) {
      this.options = options;
    }
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
