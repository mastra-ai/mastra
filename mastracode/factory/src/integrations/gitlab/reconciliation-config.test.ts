import { afterEach, describe, expect, it, vi } from 'vitest';

import { gitlabReconciliationInterval } from './reconciliation-config.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GitLab reconciliation config', () => {
  it('uses the provider-wide interval ahead of the legacy interval', () => {
    vi.stubEnv('MASTRACODE_GITLAB_RECONCILE_INTERVAL_MS', '45000');
    vi.stubEnv('MASTRACODE_GITLAB_ISSUE_RECONCILE_INTERVAL_MS', '60000');
    expect(gitlabReconciliationInterval()).toBe(45_000);
  });
});
