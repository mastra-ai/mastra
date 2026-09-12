/**
 * Unit tests for the multi-account OAuth registry in AuthStorage.
 *
 * Each test points AuthStorage at an isolated temp auth.json (explicit path,
 * plus MASTRA_APP_DATA_DIR pointed at a temp dir in case any code path ever
 * falls back to the default location), following the isolation precedent in
 * mastracode-gateway.test.ts.
 */

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Isolate the app data dir before any import that could read it.
vi.hoisted(() => {
  process.env.MASTRA_APP_DATA_DIR = `${process.env.TMPDIR ?? '/tmp'}/mastracode-auth-storage-${process.pid}-${Date.now()}`;
  process.env.MASTRA_TELEMETRY_DISABLED = '1';
});

import { anthropicOAuthProvider } from './providers/anthropic.js';
import { AuthStorage } from './storage.js';
import type { OAuthAccountRecord, OAuthCredential, OAuthCredentials } from './types.js';

const PROVIDER = 'anthropic';
const FUTURE = Date.now() + 60 * 60 * 1000;
const PAST = Date.now() - 60 * 60 * 1000;

function oauthCred(refresh: string, access: string, expires: number = FUTURE): OAuthCredential {
  return { type: 'oauth', refresh, access, expires };
}

function accountRecord(
  refresh: string,
  access: string,
  opts: { active?: boolean; label?: string; expires?: number; addedAt?: string } = {},
): OAuthAccountRecord {
  const id = `${PROVIDER}:${createHash('sha256').update(refresh).digest('hex').slice(0, 8)}`;
  return {
    type: 'oauth-account',
    id,
    label: opts.label ?? 'Anthropic (Claude Pro/Max) account',
    addedAt: opts.addedAt ?? '2026-01-01T00:00:00.000Z',
    active: opts.active ?? false,
    refresh,
    access,
    expires: opts.expires ?? FUTURE,
  };
}

const tempDirs: string[] = [];

function makeStorage(fixture?: Record<string, unknown>): { storage: AuthStorage; authPath: string; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'auth-storage-test-'));
  tempDirs.push(dir);
  const authPath = join(dir, 'auth.json');
  if (fixture) writeFileSync(authPath, JSON.stringify(fixture, null, 2));
  return { storage: new AuthStorage(authPath), authPath, dir };
}

function readAuthJson(authPath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(authPath, 'utf-8'));
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('AuthStorage multi-account registry', () => {
  it('migrates a legacy-only auth.json into a one-entry registry without touching the slot', () => {
    const { storage, authPath } = makeStorage({ [PROVIDER]: oauthCred('r1', 'a1') });

    const accounts = storage.listAccounts(PROVIDER);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ type: 'oauth-account', refresh: 'r1', access: 'a1', active: true });
    expect(accounts[0]!.label).toContain('account');

    // Slot untouched — still the single home of the tokens, exact legacy shape.
    expect(storage.get(PROVIDER)).toEqual(oauthCred('r1', 'a1'));

    // The registry landed under accounts:<providerId>:<hash> on disk.
    const onDisk = readAuthJson(authPath);
    const registryKeys = Object.keys(onDisk).filter(k => k.startsWith(`accounts:${PROVIDER}:`));
    expect(registryKeys).toHaveLength(1);
    expect(onDisk[PROVIDER]).toEqual({ type: 'oauth', refresh: 'r1', access: 'a1', expires: FUTURE });
  });

  it('treats the slot as the winner when an external writer replaced its tokens (slot-wins migration)', () => {
    const entry1 = accountRecord('old-r1', 'old-a1', { active: true, label: 'Work' });
    const entry2 = accountRecord('r2', 'a2');
    const { storage } = makeStorage({
      [PROVIDER]: oauthCred('new-r1', 'new-a1'),
      [`accounts:${entry1.id}`]: entry1,
      [`accounts:${entry2.id}`]: entry2,
    });

    const accounts = storage.listAccounts(PROVIDER);
    expect(accounts).toHaveLength(2);
    const active = storage.getActiveAccount(PROVIDER);
    expect(active?.id).toBe(entry1.id);
    expect(active?.label).toBe('Work'); // identity preserved
    expect(active).toMatchObject({ refresh: 'new-r1', access: 'new-a1' }); // slot tokens adopted
    expect(storage.get(PROVIDER)).toMatchObject({ type: 'oauth', refresh: 'new-r1', access: 'new-a1' });
  });

  it('addAccount twice yields two entries, the second active, tokens single-homed', async () => {
    const { storage } = makeStorage();

    await storage.addAccount(PROVIDER, { refresh: 'r1', access: 'a1', expires: FUTURE });
    await storage.addAccount(PROVIDER, { refresh: 'r2', access: 'a2', expires: FUTURE });

    const accounts = storage.listAccounts(PROVIDER);
    expect(accounts).toHaveLength(2);
    expect(accounts[0]).toMatchObject({ refresh: 'r1', active: false });
    expect(accounts[1]).toMatchObject({ refresh: 'r2', active: true });

    // Slot holds the second account's tokens; the first's live in its entry.
    expect(storage.get(PROVIDER)).toMatchObject({ type: 'oauth', refresh: 'r2', access: 'a2' });
    expect(accounts[0]).toMatchObject({ access: 'a1', refresh: 'r1' });
  });

  it('addAccount with a colliding id updates tokens in place (re-authentication path)', async () => {
    const { storage } = makeStorage();
    await storage.addAccount(PROVIDER, { refresh: 'r1', access: 'a1', expires: FUTURE }, 'Work');
    const original = storage.listAccounts(PROVIDER)[0]!;

    await storage.addAccount(PROVIDER, { refresh: 'r1', access: 'a1-new', expires: FUTURE });

    const accounts = storage.listAccounts(PROVIDER);
    expect(accounts).toHaveLength(1); // no duplicate appended
    expect(accounts[0]).toMatchObject({
      id: original.id,
      label: 'Work', // label preserved
      addedAt: original.addedAt, // position/identity preserved
      access: 'a1-new', // tokens updated
      active: true,
    });
    expect(storage.get(PROVIDER)).toMatchObject({ access: 'a1-new' });
  });

  it('activateAccount rotates in insertion order with wrap; undefined for a single-entry registry', async () => {
    const { storage } = makeStorage();
    await storage.addAccount(PROVIDER, { refresh: 'r1', access: 'a1', expires: FUTURE });
    await storage.addAccount(PROVIDER, { refresh: 'r2', access: 'a2', expires: FUTURE });
    await storage.addAccount(PROVIDER, { refresh: 'r3', access: 'a3', expires: FUTURE });
    const [a, b, c] = storage.listAccounts(PROVIDER);

    storage.activateAccount(PROVIDER, a!.id);
    expect(storage.getActiveAccount(PROVIDER)?.id).toBe(a!.id);
    expect(storage.get(PROVIDER)).toMatchObject({ access: 'a1' });

    expect(storage.activateAccount(PROVIDER)?.id).toBe(b!.id);
    expect(storage.get(PROVIDER)).toMatchObject({ access: 'a2' });

    expect(storage.activateAccount(PROVIDER)?.id).toBe(c!.id);
    expect(storage.get(PROVIDER)).toMatchObject({ access: 'a3' });

    // Wraps back to the first entry.
    expect(storage.activateAccount(PROVIDER)?.id).toBe(a!.id);
    expect(storage.get(PROVIDER)).toMatchObject({ access: 'a1' });

    // Inactive entries keep their own tokens after moves.
    expect(storage.listAccounts(PROVIDER).find(e => e.id === b!.id)).toMatchObject({ access: 'a2' });

    const { storage: single } = makeStorage();
    await single.addAccount(PROVIDER, { refresh: 'solo', access: 's1', expires: FUTURE });
    expect(single.activateAccount(PROVIDER)).toBeUndefined();
  });

  it('removeAccount of the active entry activates the next; removing the last entry removes the slot', async () => {
    const { storage, authPath } = makeStorage();
    await storage.addAccount(PROVIDER, { refresh: 'r1', access: 'a1', expires: FUTURE });
    await storage.addAccount(PROVIDER, { refresh: 'r2', access: 'a2', expires: FUTURE });
    const [a, b] = storage.listAccounts(PROVIDER);

    storage.removeAccount(PROVIDER, a!.id);
    expect(storage.listAccounts(PROVIDER)).toHaveLength(1);
    expect(storage.getActiveAccount(PROVIDER)?.id).toBe(b!.id);
    expect(storage.get(PROVIDER)).toMatchObject({ refresh: 'r2', access: 'a2' });

    storage.removeAccount(PROVIDER, b!.id);
    expect(storage.listAccounts(PROVIDER)).toHaveLength(0);
    expect(storage.get(PROVIDER)).toBeUndefined();
    expect(readAuthJson(authPath)[PROVIDER]).toBeUndefined();
    expect(storage.isLoggedIn(PROVIDER)).toBe(false);
  });

  it('rotates to a sibling account when the active account refresh fails', async () => {
    const entry1 = accountRecord('r1', 'a1', { active: true, expires: PAST });
    const entry2 = accountRecord('r2', 'a2');
    const { storage } = makeStorage({
      [PROVIDER]: oauthCred('r1', 'a1', PAST),
      [`accounts:${entry1.id}`]: entry1,
      [`accounts:${entry2.id}`]: entry2,
    });

    vi.spyOn(anthropicOAuthProvider, 'refreshToken').mockImplementation(async (creds: OAuthCredentials) => {
      if (creds.refresh === 'r1') throw new Error('refresh rejected');
      return { ...creds };
    });

    const key = await storage.getApiKey(PROVIDER);
    expect(key).toBe('a2');
    expect(storage.get(PROVIDER)).toMatchObject({ type: 'oauth', refresh: 'r2', access: 'a2' });
    expect(storage.getActiveAccount(PROVIDER)?.id).toBe(entry2.id);
  });

  it('restores the originally active account and keeps every credential when the whole pool fails to refresh', async () => {
    const entry1 = accountRecord('r1', 'a1', { active: true, expires: PAST });
    const entry2 = accountRecord('r2', 'a2', { expires: PAST });
    const { storage } = makeStorage({
      [PROVIDER]: oauthCred('r1', 'a1', PAST),
      [`accounts:${entry1.id}`]: entry1,
      [`accounts:${entry2.id}`]: entry2,
    });

    const refreshMock = vi.spyOn(anthropicOAuthProvider, 'refreshToken').mockRejectedValue(new Error('down'));

    expect(await storage.getApiKey(PROVIDER)).toBeUndefined();
    // Original active restored, nothing deleted.
    expect(storage.get(PROVIDER)).toMatchObject({ refresh: 'r1' });
    expect(storage.getActiveAccount(PROVIDER)?.id).toBe(entry1.id);
    expect(storage.listAccounts(PROVIDER)).toHaveLength(2);
    // Both instances got their refresh attempt.
    expect(refreshMock).toHaveBeenCalledTimes(2);
  });

  it('refreshes an expired sibling during rotation instead of dead-ending the walk', async () => {
    const entry1 = accountRecord('r1', 'a1', { active: true, expires: PAST });
    const entry2 = accountRecord('r2', 'a2-stale', { expires: PAST });
    const { storage } = makeStorage({
      [PROVIDER]: oauthCred('r1', 'a1', PAST),
      [`accounts:${entry1.id}`]: entry1,
      [`accounts:${entry2.id}`]: entry2,
    });

    vi.spyOn(anthropicOAuthProvider, 'refreshToken').mockImplementation(async (creds: OAuthCredentials) => {
      if (creds.refresh === 'r1') throw new Error('refresh rejected');
      return { refresh: 'r2', access: 'a2-fresh', expires: FUTURE };
    });

    const key = await storage.getApiKey(PROVIDER);
    expect(key).toBe('a2-fresh');
    expect(storage.get(PROVIDER)).toMatchObject({ refresh: 'r2', access: 'a2-fresh' });
    // The active registry entry mirrors the fresh tokens.
    expect(storage.getActiveAccount(PROVIDER)).toMatchObject({ id: entry2.id, access: 'a2-fresh' });
  });

  it('dedupes concurrent refreshes per instance', async () => {
    const { storage } = makeStorage({ [PROVIDER]: oauthCred('r1', 'a1', PAST) }); // migrated: one active entry

    let resolveRefresh!: (creds: OAuthCredentials) => void;
    const refreshMock = vi.spyOn(anthropicOAuthProvider, 'refreshToken').mockImplementation(
      creds =>
        new Promise<OAuthCredentials>(resolve => {
          resolveRefresh = () => resolve({ refresh: creds.refresh, access: 'a1-fresh', expires: FUTURE });
        }),
    );

    const p1 = storage.getApiKey(PROVIDER);
    const p2 = storage.getApiKey(PROVIDER);
    resolveRefresh();
    expect(await p1).toBe('a1-fresh');
    expect(await p2).toBe('a1-fresh');
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('reads a pre-feature auth.json exactly as before (backward compatibility)', async () => {
    const { storage } = makeStorage({
      [PROVIDER]: oauthCred('legacy-r', 'legacy-a'),
      'apikey:xai': { type: 'api_key', key: 'sk-xai' },
    });

    // The migration added a registry entry, but the read surface is unchanged.
    expect(storage.get(PROVIDER)).toEqual(oauthCred('legacy-r', 'legacy-a'));
    expect(storage.isLoggedIn(PROVIDER)).toBe(true);
    expect(storage.getStoredApiKey('xai')).toBe('sk-xai');
    expect(await storage.getApiKey(PROVIDER)).toBe('legacy-a'); // unexpired: no refresh involved
    // Registry keys never surface through get().
    const accounts = storage.listAccounts(PROVIDER);
    expect(storage.get(`accounts:${accounts[0]!.id}`)).toBeUndefined();
  });

  it('skips malformed accounts: values instead of crashing load', () => {
    const { storage } = makeStorage({
      [PROVIDER]: oauthCred('r1', 'a1'),
      [`accounts:${PROVIDER}:garbage1`]: 'not-an-object',
      [`accounts:${PROVIDER}:garbage2`]: { type: 'oauth', refresh: 'x', access: 'y', expires: FUTURE },
      [`accounts:${PROVIDER}:garbage3`]: { type: 'oauth-account', id: 'no-tokens' },
    });

    const accounts = storage.listAccounts(PROVIDER);
    expect(accounts).toHaveLength(1); // only the adopted slot entry
    expect(accounts[0]).toMatchObject({ refresh: 'r1', active: true });
    expect(storage.get(PROVIDER)).toEqual(oauthCred('r1', 'a1'));
  });

  it('login routes through the account registry: a second login keeps the first account intact', async () => {
    const { storage } = makeStorage();
    const callbacks = { onAuth: () => {}, onPrompt: async () => '' };
    vi.spyOn(anthropicOAuthProvider, 'login')
      .mockResolvedValueOnce({ refresh: 'r1', access: 'a1', expires: FUTURE })
      .mockResolvedValueOnce({ refresh: 'r2', access: 'a2', expires: FUTURE });

    await storage.login(PROVIDER, callbacks);
    await storage.login(PROVIDER, callbacks);

    const accounts = storage.listAccounts(PROVIDER);
    expect(accounts).toHaveLength(2);
    // The first account's tokens survive in its registry entry.
    expect(accounts[0]).toMatchObject({ refresh: 'r1', access: 'a1', active: false });
    expect(accounts[1]).toMatchObject({ refresh: 'r2', access: 'a2', active: true });
    expect(storage.get(PROVIDER)).toMatchObject({ type: 'oauth', refresh: 'r2', access: 'a2' });
  });

  it('addAccount labels the account from the provider hook when available', async () => {
    const { storage } = makeStorage();
    const account = await storage.addAccount('openai-codex', {
      refresh: 'cr1',
      access: 'ca1',
      expires: FUTURE,
      accountId: 'acct-1',
      email: 'dev@openai.com',
    });
    expect(account.label).toBe('dev@openai.com');
  });

  it('multi-account kimi auth.json satisfies the startup availability check', async () => {
    const KIMI = 'kimi-for-coding';
    const device1 = 'aa'.repeat(16);
    const device2 = 'bb'.repeat(16);
    const { storage } = makeStorage();
    await storage.addAccount(KIMI, { refresh: 'kr1', access: 'ka1', expires: FUTURE, deviceId: device1 });
    await storage.addAccount(KIMI, { refresh: 'kr2', access: 'ka2', expires: FUTURE, deviceId: device2 });

    // Replicates the availability expression at mastracode/sdk/src/index.ts:1026-1030
    // verbatim: the slot must still carry a valid oauth credential + deviceId.
    const { isKimiCodingDeviceId } = await import('./providers/kimi-coding.js');
    const kimiCodingCred = storage.get(KIMI);
    const availability =
      kimiCodingCred?.type === 'oauth' && isKimiCodingDeviceId(kimiCodingCred.deviceId)
        ? 'oauth'
        : (kimiCodingCred?.type === 'api_key' && kimiCodingCred.key.trim().length > 0) ||
            Boolean(process.env.KIMI_API_KEY?.trim())
          ? 'apikey'
          : false;
    expect(availability).toBe('oauth');
    expect((kimiCodingCred as { deviceId?: string })?.deviceId).toBe(device2);
  });

  it('logout removes the slot and every registered account', async () => {
    const { storage, authPath } = makeStorage();
    await storage.addAccount(PROVIDER, { refresh: 'r1', access: 'a1', expires: FUTURE });
    await storage.addAccount(PROVIDER, { refresh: 'r2', access: 'a2', expires: FUTURE });

    storage.logout(PROVIDER);

    expect(storage.listAccounts(PROVIDER)).toHaveLength(0);
    expect(storage.get(PROVIDER)).toBeUndefined();
    const onDisk = readAuthJson(authPath);
    expect(Object.keys(onDisk).filter(k => k.startsWith(`accounts:${PROVIDER}:`))).toHaveLength(0);
  });
});
