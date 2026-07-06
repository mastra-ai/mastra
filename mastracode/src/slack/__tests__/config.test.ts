import { describe, expect, it, vi } from 'vitest';

import type { AuthStorage } from '../../auth/storage.js';
import type { SlackSettings } from '../../onboarding/settings.js';
import { buildSlackMcpServers, hasSlackToken, SLACK_MCP_SERVER_NAME, SLACK_MCP_URL } from '../config.js';

function makeAuthStorage(overrides: Partial<AuthStorage> = {}): AuthStorage {
  return {
    getApiKey: vi.fn(async () => undefined),
    get: vi.fn(() => undefined),
    ...overrides,
  } as unknown as AuthStorage;
}

const enabled: SlackSettings = { enabled: true, permissionLevel: 'read-only' };
const disabled: SlackSettings = { enabled: false, permissionLevel: 'read-only' };

describe('buildSlackMcpServers', () => {
  it('returns no entry when slack is disabled', async () => {
    const authStorage = makeAuthStorage({ getApiKey: vi.fn(async () => 'xoxp-1') });
    const servers = await buildSlackMcpServers(authStorage, disabled);
    expect(servers).toEqual({});
    // Must not even ask for a token when disabled.
    expect(authStorage.getApiKey).not.toHaveBeenCalled();
  });

  it('returns no entry when settings are undefined', async () => {
    const servers = await buildSlackMcpServers(makeAuthStorage(), undefined);
    expect(servers).toEqual({});
  });

  it('returns no entry when enabled but no token is stored', async () => {
    const authStorage = makeAuthStorage({ getApiKey: vi.fn(async () => undefined) });
    const servers = await buildSlackMcpServers(authStorage, enabled);
    expect(servers).toEqual({});
    expect(authStorage.getApiKey).toHaveBeenCalledWith('slack');
  });

  it('injects a bearer header sourced from AuthStorage when enabled + connected', async () => {
    const authStorage = makeAuthStorage({ getApiKey: vi.fn(async () => 'xoxp-secret') });
    const servers = await buildSlackMcpServers(authStorage, enabled);

    expect(Object.keys(servers)).toEqual([SLACK_MCP_SERVER_NAME]);
    const entry = servers[SLACK_MCP_SERVER_NAME] as { url: string; headers: Record<string, string> };
    expect(entry.url).toBe(SLACK_MCP_URL);
    expect(entry.headers).toEqual({ Authorization: 'Bearer xoxp-secret' });
    // The raw token only lives in the in-memory header, sourced via getApiKey.
    expect(authStorage.getApiKey).toHaveBeenCalledWith('slack');
  });
});

describe('hasSlackToken', () => {
  it('is true only when an oauth credential is stored', () => {
    expect(hasSlackToken(makeAuthStorage({ get: vi.fn(() => undefined) }))).toBe(false);
    expect(hasSlackToken(makeAuthStorage({ get: vi.fn(() => ({ type: 'api', key: 'x' }) as any) }))).toBe(false);
    expect(
      hasSlackToken(
        makeAuthStorage({ get: vi.fn(() => ({ type: 'oauth', access: 'a', refresh: 'r', expires: 1 }) as any) }),
      ),
    ).toBe(true);
  });
});
