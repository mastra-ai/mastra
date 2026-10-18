/**
 * Wrapper-level account snapshot tests: after account rotation, OAuth fetch
 * wrappers must stamp account-scoped headers from the same credential snapshot
 * as the token — Kimi's device id, Codex's ChatGPT-Account-ID, and Copilot's
 * enterprise URL. Each test switches the pointer again after snapshot capture
 * and verifies the in-flight request remains internally coherent.
 */

import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.MASTRA_APP_DATA_DIR = `${process.env.TMPDIR ?? '/tmp'}/mastracode-oauth-rotation-${process.pid}-${Date.now()}`;
  process.env.MASTRA_TELEMETRY_DISABLED = '1';
});

const fetchMock = vi.fn();

function outboundRequest(): Request {
  const [input, init] = fetchMock.mock.calls[0]!;
  return input instanceof Request && !init ? input : new Request(input, init);
}

import { AuthStorage } from '../../auth/storage.js';
import type { OAuthAccountRecord, OAuthCredential } from '../../auth/types.js';

const FUTURE = Date.now() + 60 * 60 * 1000;

function accountEntry(providerId: string, cred: Record<string, unknown>, active: boolean): OAuthAccountRecord {
  const refresh = cred.refresh as string;
  const id = `${providerId}:${createHash('sha256').update(refresh).digest('hex').slice(0, 8)}`;
  return {
    type: 'oauth-account',
    id,
    label: `${providerId} account`,
    addedAt: '2026-01-01T00:00:00.000Z',
    active,
    ...(cred as object),
  } as OAuthAccountRecord;
}

const tempDirs: string[] = [];

function makeRotatingStorage(
  providerId: string,
  activeCred: Record<string, unknown>,
  siblingCred: Record<string, unknown>,
): AuthStorage {
  const dir = mkdtempSync(join(tmpdir(), 'oauth-rotation-test-'));
  tempDirs.push(dir);
  const fixture: Record<string, unknown> = {
    [providerId]: { type: 'oauth', ...activeCred } satisfies OAuthCredential,
    [`accounts:${accountEntry(providerId, activeCred, true).id}`]: accountEntry(providerId, activeCred, true),
    [`accounts:${accountEntry(providerId, siblingCred, false).id}`]: accountEntry(providerId, siblingCred, false),
  };
  const authPath = join(dir, 'auth.json');
  writeFileSync(authPath, JSON.stringify(fixture, null, 2));
  return new AuthStorage(authPath);
}

function activateSiblingThenReactivateOriginalAfterSnapshot(storage: AuthStorage, providerId: string): void {
  const [originalAccount, siblingAccount] = storage.listAccounts(providerId);
  storage.activateAccount(providerId, siblingAccount!.id);
  const getSnapshot = storage.getOAuthCredential.bind(storage);
  vi.spyOn(storage, 'getOAuthCredential').mockImplementation(async id => {
    const snapshot = await getSnapshot(id);
    storage.activateAccount(providerId, originalAccount!.id);
    return snapshot;
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  while (tempDirs.length) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('oauth fetch wrappers follow account rotation', () => {
  it('Kimi device headers match the account whose token is used', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset().mockResolvedValue(new Response('{}', { status: 200 }));
    const device1 = '11'.repeat(16);
    const device2 = '22'.repeat(16);
    const storage = makeRotatingStorage(
      'kimi-for-coding',
      { refresh: 'kr1', access: 'ka1', expires: FUTURE, deviceId: device1 },
      { refresh: 'kr2', access: 'ka2', expires: FUTURE, deviceId: device2 },
    );
    activateSiblingThenReactivateOriginalAfterSnapshot(storage, 'kimi-for-coding');

    const { buildKimiCodingOAuthFetch } = await import('../kimi-coding.js');
    const fetchWithOAuth = buildKimiCodingOAuthFetch({ credentialStore: storage });
    await fetchWithOAuth('https://api.kimi.com/coding/v1/messages', { headers: {} });

    const headers = outboundRequest().headers;
    expect(headers.get('Authorization')).toBe('Bearer ka2');
    expect(headers.get('x-msh-device-id')).toBe(device2);
  });

  it('Codex ChatGPT-Account-ID follows the rotated account', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset().mockResolvedValue(new Response('{}', { status: 200 }));
    const storage = makeRotatingStorage(
      'openai-codex',
      { refresh: 'cr1', access: 'ca1', expires: FUTURE, accountId: 'acct-1' },
      { refresh: 'cr2', access: 'ca2', expires: FUTURE, accountId: 'acct-2' },
    );
    activateSiblingThenReactivateOriginalAfterSnapshot(storage, 'openai-codex');

    const { buildOpenAICodexOAuthFetch } = await import('../openai-codex.js');
    const fetchWithOAuth = buildOpenAICodexOAuthFetch({ authStorage: storage, rewriteUrl: false });
    await fetchWithOAuth('https://chatgpt.com/backend-api/codex/responses', { headers: {} });

    const headers = outboundRequest().headers;
    expect(headers.get('Authorization')).toBe('Bearer ca2');
    expect(headers.get('ChatGPT-Account-ID')).toBe('acct-2');
  });

  it('Copilot enterprise URL follows the rotated account', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset().mockResolvedValue(new Response('{}', { status: 200 }));
    const storage = makeRotatingStorage(
      'github-copilot',
      { refresh: 'gr1', access: 'ga1', expires: FUTURE, enterpriseUrl: 'company-a.ghe.com' },
      { refresh: 'gr2', access: 'ga2', expires: FUTURE, enterpriseUrl: 'company-b.ghe.com' },
    );
    activateSiblingThenReactivateOriginalAfterSnapshot(storage, 'github-copilot');

    const { buildGitHubCopilotOAuthFetch } = await import('../github-copilot.js');
    const fetchWithOAuth = buildGitHubCopilotOAuthFetch({ authStorage: storage });
    await fetchWithOAuth('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {},
      body: JSON.stringify({ messages: [], model: 'gpt-4.1' }),
    });

    const outbound = outboundRequest();
    // The enterprise URL followed the rotation (account 2's domain, not account 1's);
    // getGitHubCopilotBaseUrl prefixes the GHE domain with `copilot-api.`.
    expect(new URL(outbound.url).hostname).toBe('copilot-api.company-b.ghe.com');
    expect(outbound.headers.get('Authorization')).toBe('Bearer ga2');
  });
});
