import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The state-secret guard must run before any DB work; stub the side-effectful
// imports so `resolveLinearReady` can be exercised without a real database.
vi.mock('./sandbox-reattach-registration', () => ({ registerSandboxReattach: () => {} }));
vi.mock('./linear/db', () => ({ ensureLinearDbReady: vi.fn().mockResolvedValue(undefined) }));

import { resolveLinearReady } from './web-surface';

// ── Linear-only state-secret deploy scenario ─────────────────────────────
// Linear's OAuth `state` is signed with the secret shared with the GitHub
// feature. GitHub's own `assertReplicaStableStateSecret()` is a no-op when the
// GitHub feature is off, so a Linear-only deployment relies on
// `resolveLinearReady()` running its own fail-loud check.

const ENV_KEYS = [
  'LINEAR_CLIENT_ID',
  'LINEAR_CLIENT_SECRET',
  'WORKOS_API_KEY',
  'WORKOS_CLIENT_ID',
  'APP_DATABASE_URL',
  'GITHUB_APP_WEBHOOK_SECRET',
  'WORKOS_COOKIE_PASSWORD',
] as const;

const saved: Record<string, string | undefined> = {};
let stderrSpy: ReturnType<typeof vi.spyOn>;

function enableLinearFeature(): void {
  process.env.LINEAR_CLIENT_ID = 'linear-client';
  process.env.LINEAR_CLIENT_SECRET = 'linear-secret';
  process.env.WORKOS_API_KEY = 'workos-key';
  process.env.WORKOS_CLIENT_ID = 'workos-client';
  process.env.APP_DATABASE_URL = 'postgres://localhost/app';
}

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
  stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  stderrSpy.mockRestore();
});

describe('resolveLinearReady startup guard', () => {
  it('throws when Linear is enabled but no replica-stable state secret is set', async () => {
    enableLinearFeature();
    await expect(resolveLinearReady()).rejects.toThrow(/replica-stable state secret/);
  });

  it('resolves when Linear is enabled and an explicit secret is set', async () => {
    enableLinearFeature();
    process.env.WORKOS_COOKIE_PASSWORD = 'cookie-pw-stable';
    await expect(resolveLinearReady()).resolves.toBe(true);
  });

  it('returns false without throwing when the Linear feature is off', async () => {
    await expect(resolveLinearReady()).resolves.toBe(false);
  });
});
