import { afterEach, describe, expect, it, vi } from 'vitest';

import { gitlabReconciliationEnabled, gitlabReconciliationInterval } from './reconciliation-config.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GitLab reconciliation config', () => {
  it('uses the provider-wide switch ahead of the legacy issue-only switch', () => {
    vi.stubEnv('MASTRACODE_GITLAB_RECONCILE_ENABLED', 'false');
    vi.stubEnv('MASTRACODE_GITLAB_ISSUE_RECONCILE_ENABLED', 'true');
    expect(gitlabReconciliationEnabled()).toBe(false);
  });

  it('keeps the legacy issue-only switch compatible', () => {
    vi.stubEnv('MASTRACODE_GITLAB_RECONCILE_ENABLED', '');
    vi.stubEnv('MASTRACODE_GITLAB_ISSUE_RECONCILE_ENABLED', 'false');
    expect(gitlabReconciliationEnabled()).toBe(false);
  });

  it('uses the provider-wide interval ahead of the legacy interval', () => {
    vi.stubEnv('MASTRACODE_GITLAB_RECONCILE_INTERVAL_MS', '45000');
    vi.stubEnv('MASTRACODE_GITLAB_ISSUE_RECONCILE_INTERVAL_MS', '60000');
    expect(gitlabReconciliationInterval()).toBe(45_000);
  });
});
