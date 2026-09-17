/**
 * Unit tests for the multi-account OAuth registry in AuthStorage.
 *
 * Each test points AuthStorage at an isolated temp auth.json (explicit path,
 * plus MASTRA_APP_DATA_DIR pointed at a temp dir in case any code path ever
 * falls back to the default location), following the isolation precedent in
 * mastracode-gateway.test.ts.
 */

import { spawn } from 'node:child_process';
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
const CODEX = 'openai-codex';
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

  it('heals a registry whose legacy slot was deleted by mirroring the active entry back into the slot', () => {
    const active = accountRecord('r1', 'a1', { active: true, label: 'Work' });
    const inactive = accountRecord('r2', 'a2', { label: 'Personal' });
    const { storage, authPath } = makeStorage({
      [`accounts:${active.id}`]: active,
      [`accounts:${inactive.id}`]: inactive,
    });

    // Without the slot, isLoggedIn() would report logged-out while
    // listAccounts() still lists accounts — the heal re-mirrors the slot.
    expect(storage.isLoggedIn(PROVIDER)).toBe(true);
    expect(storage.get(PROVIDER)).toEqual(oauthCred('r1', 'a1'));
    expect(storage.listAccounts(PROVIDER)).toHaveLength(2);
    expect(storage.listAccounts(PROVIDER).find(account => account.active)?.id).toBe(active.id);

    const onDisk = readAuthJson(authPath);
    expect(onDisk[PROVIDER]).toEqual({ type: 'oauth', refresh: 'r1', access: 'a1', expires: FUTURE });
  });

  it('remove() clears the registry so a fresh load cannot resurrect the provider', () => {
    const active = accountRecord('r1', 'a1', { active: true, label: 'Work' });
    const inactive = accountRecord('r2', 'a2', { label: 'Personal' });
    const { storage, authPath } = makeStorage({
      [PROVIDER]: oauthCred('r1', 'a1'),
      [`accounts:${active.id}`]: active,
      [`accounts:${inactive.id}`]: inactive,
    });

    storage.remove(PROVIDER);

    // The registry dies with the slot — nothing left for migration to heal from.
    const onDisk = readAuthJson(authPath);
    expect(Object.keys(onDisk).filter(k => k.startsWith(`accounts:${PROVIDER}:`))).toHaveLength(0);
    expect(onDisk[PROVIDER]).toBeUndefined();

    // A fresh process (provider fetch wrappers reload on every request) must
    // see the provider fully signed out, not healed back in.
    const reloaded = new AuthStorage(authPath);
    expect(reloaded.isLoggedIn(PROVIDER)).toBe(false);
    expect(reloaded.get(PROVIDER)).toBeUndefined();
    expect(reloaded.listAccounts(PROVIDER)).toHaveLength(0);
  });

  it('activates the first registry entry when both slot and active marker are missing', () => {
    const first = accountRecord('r1', 'a1');
    const second = accountRecord('r2', 'a2');
    const { storage } = makeStorage({
      [`accounts:${first.id}`]: first,
      [`accounts:${second.id}`]: second,
    });

    expect(storage.isLoggedIn(PROVIDER)).toBe(true);
    expect(storage.get(PROVIDER)).toEqual(oauthCred('r1', 'a1'));
    expect(storage.listAccounts(PROVIDER).find(account => account.active)?.id).toBe(first.id);
  });

  it('never exposes a partial auth.json to a concurrently running legacy reader', async () => {
    const entry = accountRecord('r1', 'a1', { active: true, label: 'Work' });
    const padding = Object.fromEntries(
      Array.from({ length: 100 }, (_, index) => [`padding:${index}`, { type: 'api_key', key: 'x'.repeat(1024) }]),
    );
    const { storage, authPath, dir } = makeStorage({
      [PROVIDER]: oauthCred('r1', 'a1'),
      [`accounts:${entry.id}`]: entry,
      ...padding,
    });
    const donePath = join(dir, 'done');
    const resultPath = join(dir, 'legacy-reader-result.json');
    const reader = spawn(
      process.execPath,
      [
        '-e',
        `const { existsSync, readFileSync, writeFileSync } = require('node:fs');
         let parseFailures = 0;
         let missingSlots = 0;
         process.stdout.write('ready\\n');
         while (!existsSync(${JSON.stringify(donePath)})) {
           let data = {};
           try { data = JSON.parse(readFileSync(${JSON.stringify(authPath)}, 'utf8')); }
           catch { parseFailures++; }
           if (data.anthropic?.type !== 'oauth') missingSlots++;
         }
         writeFileSync(${JSON.stringify(resultPath)}, JSON.stringify({ parseFailures, missingSlots }));`,
      ],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );
    await new Promise<void>((resolve, reject) => {
      reader.stdout.once('data', () => resolve());
      reader.once('error', reject);
    });
    const readerExit = new Promise<void>((resolve, reject) => {
      reader.once('exit', code => (code === 0 ? resolve() : reject(new Error(`Legacy reader exited ${code}`))));
      reader.once('error', reject);
    });

    for (let i = 0; i < 500; i++) storage.renameAccount(PROVIDER, entry.id, `Work ${i}`);
    writeFileSync(donePath, 'done');
    await readerExit;

    expect(JSON.parse(readFileSync(resultPath, 'utf8'))).toEqual({ parseFailures: 0, missingSlots: 0 });
  });

  it('reloads before generic writes so stale instances preserve unrelated credentials', () => {
    const { storage, authPath } = makeStorage();
    const staleStorage = new AuthStorage(authPath);

    storage.set('apikey:anthropic', { type: 'api_key', key: 'anthropic-key' });
    staleStorage.set('apikey:xai', { type: 'api_key', key: 'xai-key' });

    expect(readAuthJson(authPath)).toMatchObject({
      'apikey:anthropic': { type: 'api_key', key: 'anthropic-key' },
      'apikey:xai': { type: 'api_key', key: 'xai-key' },
    });

    storage.remove('apikey:anthropic');
    expect(readAuthJson(authPath)).toEqual({ 'apikey:xai': { type: 'api_key', key: 'xai-key' } });
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

  it('addAccount with activate:false appends without touching the active account or slot', async () => {
    const { storage } = makeStorage();

    await storage.addAccount(PROVIDER, { refresh: 'r1', access: 'a1', expires: FUTURE }, { label: 'Work' });
    const added = await storage.addAccount(
      PROVIDER,
      { refresh: 'r2', access: 'a2', expires: FUTURE },
      { activate: false },
    );

    expect(added).toMatchObject({ refresh: 'r2', active: false });
    const accounts = storage.listAccounts(PROVIDER);
    expect(accounts).toHaveLength(2);
    expect(accounts[0]).toMatchObject({ refresh: 'r1', active: true });
    expect(accounts[1]).toMatchObject({ refresh: 'r2', active: false });
    // Slot still holds the first (active) account's tokens; the new account's
    // tokens live only in its entry.
    expect(storage.get(PROVIDER)).toMatchObject({ type: 'oauth', refresh: 'r1', access: 'a1' });
  });

  it("addAccount with activate:false still activates the provider's first account", async () => {
    const { storage } = makeStorage();

    const added = await storage.addAccount(
      PROVIDER,
      { refresh: 'r1', access: 'a1', expires: FUTURE },
      { activate: false },
    );

    expect(added.active).toBe(true);
    expect(storage.getActiveAccount(PROVIDER)?.refresh).toBe('r1');
    expect(storage.get(PROVIDER)).toMatchObject({ refresh: 'r1', access: 'a1' });
  });

  it('addAccount with activate:false on the already-active entry still moves fresh tokens into the slot', async () => {
    const { storage } = makeStorage();
    await storage.addAccount(PROVIDER, { refresh: 'r1', access: 'a1', expires: FUTURE });
    await storage.addAccount(PROVIDER, { refresh: 'r2', access: 'a2', expires: FUTURE }, { activate: false });

    // Re-auth of the active account through the plain add path (same refresh
    // token): entry updated in place, active kept, slot gets the new tokens.
    await storage.addAccount(PROVIDER, { refresh: 'r1', access: 'a1-new', expires: FUTURE }, { activate: false });

    const accounts = storage.listAccounts(PROVIDER);
    expect(accounts).toHaveLength(2);
    expect(accounts[0]).toMatchObject({ refresh: 'r1', access: 'a1-new', active: true });
    expect(accounts[1]).toMatchObject({ refresh: 'r2', active: false });
    expect(storage.get(PROVIDER)).toMatchObject({ refresh: 'r1', access: 'a1-new' });
  });

  it('addAccount with a colliding id updates tokens in place (re-authentication path)', async () => {
    const { storage } = makeStorage();
    await storage.addAccount(PROVIDER, { refresh: 'r1', access: 'a1', expires: FUTURE }, { label: 'Work' });
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

  it('leaves account switching to the rotation processor when an automatic refresh fails', async () => {
    const entry1 = accountRecord('r1', 'a1', { active: true, expires: PAST });
    const entry2 = accountRecord('r2', 'a2');
    const { storage } = makeStorage({
      [PROVIDER]: oauthCred('r1', 'a1', PAST),
      [`accounts:${entry1.id}`]: entry1,
      [`accounts:${entry2.id}`]: entry2,
    });

    const refreshMock = vi.spyOn(anthropicOAuthProvider, 'refreshToken').mockRejectedValue(new Error('down'));

    expect(await storage.getApiKey(PROVIDER)).toBeUndefined();
    expect(refreshMock).toHaveBeenCalledOnce();
    expect(storage.get(PROVIDER)).toMatchObject({ refresh: 'r1', access: 'a1' });
    expect(storage.getActiveAccount(PROVIDER)?.id).toBe(entry1.id);
    expect(storage.listAccounts(PROVIDER)).toHaveLength(2);
  });

  it('does not overwrite a newly active account when another account finishes refreshing', async () => {
    const entry1 = accountRecord('r1', 'a1', { active: true, expires: PAST });
    const entry2 = accountRecord('r2', 'a2');
    const { storage } = makeStorage({
      [PROVIDER]: oauthCred('r1', 'a1', PAST),
      [`accounts:${entry1.id}`]: entry1,
      [`accounts:${entry2.id}`]: entry2,
    });

    let resolveRefresh!: (creds: OAuthCredentials) => void;
    vi.spyOn(anthropicOAuthProvider, 'refreshToken').mockImplementation(
      () =>
        new Promise<OAuthCredentials>(resolve => {
          resolveRefresh = resolve;
        }),
    );

    const pendingRefresh = storage.getApiKey(PROVIDER);
    expect(storage.activateAccount(PROVIDER, entry2.id)?.id).toBe(entry2.id);
    resolveRefresh({ refresh: 'r1-fresh', access: 'a1-fresh', expires: FUTURE });

    expect(await pendingRefresh).toBe('a1-fresh');
    storage.reload();
    expect(storage.getActiveAccount(PROVIDER)).toMatchObject({ id: entry2.id, refresh: 'r2', access: 'a2' });
    expect(storage.get(PROVIDER)).toMatchObject({ refresh: 'r2', access: 'a2' });
    expect(storage.listAccounts(PROVIDER).find(account => account.id === entry1.id)).toMatchObject({
      active: false,
      refresh: 'r1-fresh',
      access: 'a1-fresh',
    });
  });

  it('binds a forced refresh to the account that initiated it', async () => {
    const entry1 = accountRecord('r1', 'a1', { active: true });
    const entry2 = accountRecord('r2', 'a2');
    const { storage } = makeStorage({
      [PROVIDER]: oauthCred('r1', 'a1'),
      [`accounts:${entry1.id}`]: entry1,
      [`accounts:${entry2.id}`]: entry2,
    });

    let resolveRefresh!: (creds: OAuthCredentials) => void;
    vi.spyOn(anthropicOAuthProvider, 'refreshToken').mockImplementation(
      () =>
        new Promise<OAuthCredentials>(resolve => {
          resolveRefresh = resolve;
        }),
    );

    const pendingRefresh = storage.forceRefreshActiveAccount(PROVIDER);
    expect(storage.activateAccount(PROVIDER, entry2.id)?.id).toBe(entry2.id);
    resolveRefresh({ refresh: 'r1-forced', access: 'a1-forced', expires: FUTURE });

    expect(await pendingRefresh).toBe('a1-forced');
    storage.reload();
    expect(storage.getActiveAccount(PROVIDER)).toMatchObject({ id: entry2.id, refresh: 'r2', access: 'a2' });
    expect(storage.get(PROVIDER)).toMatchObject({ refresh: 'r2', access: 'a2' });
    expect(storage.listAccounts(PROVIDER).find(account => account.id === entry1.id)).toMatchObject({
      active: false,
      refresh: 'r1-forced',
      access: 'a1-forced',
    });
  });

  it('reads and refreshes a selected account without changing the active account', async () => {
    const entry1 = accountRecord('r1', 'a1', { active: true });
    const entry2 = accountRecord('r2', 'a2', { expires: PAST });
    const { storage } = makeStorage({
      [PROVIDER]: oauthCred('r1', 'a1'),
      [`accounts:${entry1.id}`]: entry1,
      [`accounts:${entry2.id}`]: entry2,
    });
    const refreshMock = vi.spyOn(anthropicOAuthProvider, 'refreshToken').mockResolvedValue({
      refresh: 'r2-fresh',
      access: 'a2-fresh',
      expires: FUTURE,
    });

    await expect(storage.getApiKey(PROVIDER, entry2.id)).resolves.toBe('a2-fresh');
    await expect(storage.getOAuthCredential(PROVIDER, entry2.id)).resolves.toMatchObject({
      access: 'a2-fresh',
      accountInstanceId: entry2.id,
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(storage.getActiveAccount(PROVIDER)?.id).toBe(entry1.id);
    expect(storage.get(PROVIDER)).toMatchObject({ access: 'a1' });
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

  it('re-points activation when an external writer puts a different registered account in the slot', () => {
    const entry1 = accountRecord('r1', 'a1', { active: true, label: 'Work' });
    const entry2 = accountRecord('r2', 'a2', { label: 'Personal' });
    const { storage } = makeStorage({
      // External writer swapped the slot to account 2's tokens.
      [PROVIDER]: oauthCred('r2', 'a2'),
      [`accounts:${entry1.id}`]: entry1,
      [`accounts:${entry2.id}`]: entry2,
    });

    const active = storage.getActiveAccount(PROVIDER);
    expect(active?.id).toBe(entry2.id);
    expect(active?.label).toBe('Personal');
    // No refresh-token clone: account 1's entry keeps its own tokens.
    expect(storage.listAccounts(PROVIDER).find(e => e.id === entry1.id)).toMatchObject({
      refresh: 'r1',
      active: false,
    });
    expect(storage.get(PROVIDER)).toMatchObject({ type: 'oauth', refresh: 'r2', access: 'a2' });
  });

  it('addAccount with replaceAccountId re-authorizes the picked account in place, keeping its id', async () => {
    const { storage, authPath } = makeStorage();
    await storage.addAccount(PROVIDER, { refresh: 'r1', access: 'a1', expires: FUTURE }, { label: 'Work' });
    await storage.addAccount(PROVIDER, { refresh: 'r2', access: 'a2', expires: FUTURE }, { label: 'Personal' });
    const work = storage.listAccounts(PROVIDER)[0]!;

    // Re-authentication returns a rotated refresh token.
    await storage.addAccount(
      PROVIDER,
      { refresh: 'r1-new', access: 'a1-new', expires: FUTURE },
      { replaceAccountId: work.id },
    );

    const accounts = storage.listAccounts(PROVIDER);
    expect(accounts).toHaveLength(2); // replaced, not appended
    expect(accounts[0]).toMatchObject({
      label: 'Work', // label preserved
      addedAt: work.addedAt, // identity preserved
      refresh: 'r1-new', // tokens replaced
      access: 'a1-new',
      // Re-authenticating an inactive account does not hijack the active slot.
      active: false,
    });
    // A13: the id is minted once and never derived from credentials, so
    // re-authorization keeps it — every id persisted outside auth.json
    // (settings routing preferences, per-thread routing state) stays valid.
    expect(accounts[0]!.id).toBe(work.id);
    expect(accounts[1]).toMatchObject({ label: 'Personal', active: true });
    expect(storage.get(PROVIDER)).toMatchObject({ type: 'oauth', refresh: 'r2', access: 'a2' });
    // The entry is still keyed by the same id, now holding the fresh tokens.
    expect(readAuthJson(authPath)[`accounts:${work.id}`]).toMatchObject({ refresh: 'r1-new', access: 'a1-new' });
  });

  it('re-authenticating the active account keeps it active with the new tokens in the legacy slot', async () => {
    const { storage } = makeStorage();
    await storage.addAccount(PROVIDER, { refresh: 'r1', access: 'a1', expires: FUTURE }, { label: 'Work' });
    await storage.addAccount(PROVIDER, { refresh: 'r2', access: 'a2', expires: FUTURE }, { label: 'Personal' });
    const personal = storage.getActiveAccount(PROVIDER)!;

    const returned = await storage.addAccount(
      PROVIDER,
      { refresh: 'r2-new', access: 'a2-new', expires: FUTURE },
      { replaceAccountId: personal.id },
    );

    expect(returned.active).toBe(true);
    expect(storage.getActiveAccount(PROVIDER)?.id).toBe(returned.id);
    expect(storage.get(PROVIDER)).toMatchObject({ type: 'oauth', refresh: 'r2-new', access: 'a2-new' });
    expect(storage.listAccounts(PROVIDER).find(entry => entry.label === 'Work')).toMatchObject({ active: false });
  });

  it('re-authenticating an inactive account onto the active account tokens keeps an active entry', async () => {
    const { storage, authPath } = makeStorage();
    await storage.addAccount(PROVIDER, { refresh: 'r1', access: 'a1', expires: FUTURE }, { label: 'Work' });
    const work = storage.getActiveAccount(PROVIDER)!;
    const personal = await storage.addAccount(
      PROVIDER,
      { refresh: 'r2', access: 'a2', expires: FUTURE },
      { label: 'Personal', activate: false },
    );

    // The re-authenticated credentials are Work's: both entries are the same
    // underlying subscription. Work is dropped in favor of the picked account,
    // and because Work was the active account the survivor must stay active —
    // otherwise the registry would be left with no active entry while the
    // legacy slot still held the old tokens. The survivor keeps the picked
    // account's id (A13: ids are minted, not re-derived from tokens).
    const returned = await storage.addAccount(
      PROVIDER,
      { refresh: 'r1', access: 'a1-new', expires: FUTURE },
      { replaceAccountId: personal.id },
    );

    expect(returned.active).toBe(true);
    expect(storage.getActiveAccount(PROVIDER)?.id).toBe(personal.id);
    expect(storage.listAccounts(PROVIDER)).toHaveLength(1);
    expect(storage.listAccounts(PROVIDER)[0]).toMatchObject({ active: true, label: 'Personal' });
    expect(storage.get(PROVIDER)).toMatchObject({ type: 'oauth', refresh: 'r1', access: 'a1-new' });

    // And it survives a reload: a non-empty registry always has an active entry.
    const reopened = new AuthStorage(authPath);
    expect(reopened.listAccounts(PROVIDER)).toHaveLength(1);
    expect(reopened.getActiveAccount(PROVIDER)?.id).toBe(personal.id);
  });

  it('re-authenticating onto a collided account takes that subscription’s credential metadata', async () => {
    const { storage } = makeStorage();
    // Work: the active subscription, with its own enterprise endpoint.
    await storage.addAccount(
      PROVIDER,
      { refresh: 'r1', access: 'a1', expires: FUTURE, enterpriseUrl: 'https://ghe.work.example.com' },
      { label: 'Work' },
    );
    const work = storage.getActiveAccount(PROVIDER)!;
    // Personal: inactive, no enterprise endpoint of its own.
    const personal = await storage.addAccount(
      PROVIDER,
      { refresh: 'r2', access: 'a2', expires: FUTURE },
      { label: 'Personal', activate: false },
    );

    // Re-authenticate Personal with Work's tokens *and no enterprise URL*, as a
    // token response without enterprise metadata looks. The surviving entry owns
    // Work's subscription, so it must not keep serving Personal's (absent)
    // metadata: the collided entry supplies it.
    const returned = await storage.addAccount(
      PROVIDER,
      { refresh: 'r1', access: 'a1-new', expires: FUTURE },
      { replaceAccountId: personal.id },
    );

    // The survivor is the picked account, so it keeps Personal's id (A13) while
    // taking Work's credential metadata.
    expect(returned.id).toBe(personal.id);
    expect(returned.enterpriseUrl).toBe('https://ghe.work.example.com');
    // Registry metadata still comes from the picked (target) account.
    expect(returned.label).toBe('Personal');
    expect(returned.addedAt).toBe(personal.addedAt);
    // The collided entry for the same subscription is dropped, not left as a twin.
    expect(storage.listAccounts(PROVIDER).some(entry => entry.id === work.id)).toBe(false);
  });

  it('fresh re-authentication credentials win over the collided entry’s metadata', async () => {
    const { storage } = makeStorage();
    await storage.addAccount(
      PROVIDER,
      { refresh: 'r1', access: 'a1', expires: FUTURE, enterpriseUrl: 'https://ghe.old.example.com' },
      { label: 'Work' },
    );
    const work = storage.getActiveAccount(PROVIDER)!;
    const personal = await storage.addAccount(
      PROVIDER,
      { refresh: 'r2', access: 'a2', expires: FUTURE },
      { label: 'Personal', activate: false },
    );

    const returned = await storage.addAccount(
      PROVIDER,
      { refresh: 'r1', access: 'a1-new', expires: FUTURE, enterpriseUrl: 'https://ghe.new.example.com' },
      { replaceAccountId: personal.id },
    );

    expect(returned.id).toBe(personal.id);
    expect(returned.enterpriseUrl).toBe('https://ghe.new.example.com');
    // The collided entry for the same subscription is dropped, not left as a twin.
    expect(storage.listAccounts(PROVIDER).some(entry => entry.id === work.id)).toBe(false);
  });

  it('a fresh AuthStorage instance reloads the registry intact (restart semantics)', async () => {
    const { storage, authPath } = makeStorage();
    await storage.addAccount(PROVIDER, { refresh: 'r1', access: 'a1', expires: FUTURE }, { label: 'Work' });
    await storage.addAccount(PROVIDER, { refresh: 'r2', access: 'a2', expires: FUTURE }, { label: 'Personal' });
    const before = storage.getActiveAccount(PROVIDER);

    const reopened = new AuthStorage(authPath);
    expect(reopened.listAccounts(PROVIDER).map(a => a.label)).toEqual(['Work', 'Personal']);
    expect(reopened.getActiveAccount(PROVIDER)?.id).toBe(before!.id);
    expect(reopened.get(PROVIDER)).toMatchObject({ type: 'oauth', refresh: 'r2', access: 'a2' });
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

  it('does not carry the previous account metadata into the slot on activation', async () => {
    const KIMI = 'kimi-for-coding';
    const { storage } = makeStorage();
    const deviceA = 'aa'.repeat(16);
    // A: enterprise-ish metadata. B: bare tokens for the same provider.
    await storage.addAccount(
      KIMI,
      { refresh: 'kr1', access: 'ka1', expires: FUTURE, deviceId: deviceA, enterpriseUrl: 'https://ghe.example.com' },
      { label: 'A' },
    );
    const accountB = await storage.addAccount(KIMI, { refresh: 'kr2', access: 'ka2', expires: FUTURE }, { label: 'B' });

    // Activating B moves B's tokens into the slot. A's deviceId/enterpriseUrl
    // must not ride along: the providers read those fields off the slot, so a
    // stale value would pair B's tokens with A's metadata.
    const slot = storage.get(KIMI) as Record<string, unknown> | undefined;
    expect(slot).toMatchObject({ type: 'oauth', access: accountB.access ?? 'ka2', refresh: 'kr2' });
    expect(slot?.deviceId).toBeUndefined();
    expect(slot?.enterpriseUrl).toBeUndefined();
  });

  it('prefers the legacy slot for the active account when a legacy writer refreshed it', async () => {
    const { storage, authPath } = makeStorage();
    await storage.addAccount(PROVIDER, { refresh: 'r1', access: 'a1', expires: FUTURE }, { label: 'Work' });
    const work = storage.getActiveAccount(PROVIDER)!;

    // An older build (or another worktree) refreshes the provider slot without
    // rotating the refresh token, so `migrate()`'s token-change branch never
    // reconciles the registry entry. The registry then holds stale access/expiry
    // while the slot holds the live token.
    const onDisk = readAuthJson(authPath);
    onDisk[PROVIDER] = { type: 'oauth', refresh: 'r1', access: 'a1-slot-fresh', expires: FUTURE + 1 };
    writeFileSync(authPath, JSON.stringify(onDisk), 'utf-8');

    const snapshot = await storage.getOAuthCredential(PROVIDER, work.id);

    // Slot credentials, registry identity.
    expect(snapshot).toMatchObject({ access: 'a1-slot-fresh', accountInstanceId: work.id });
  });

  it('keeps registry credentials for an inactive selected account', async () => {
    const { storage } = makeStorage();
    await storage.addAccount(PROVIDER, { refresh: 'r1', access: 'a1', expires: FUTURE }, { label: 'Work' });
    const personal = await storage.addAccount(
      PROVIDER,
      { refresh: 'r2', access: 'a2', expires: FUTURE },
      { label: 'Personal', activate: false },
    );

    // The slot carries Work's tokens; the inactive selection must not pick them
    // up — that would send Personal's request with Work's credential.
    await expect(storage.getOAuthCredential(PROVIDER, personal.id)).resolves.toMatchObject({
      access: 'a2',
      accountInstanceId: personal.id,
    });
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

  it('A13: an account id survives a token refresh (identity is minted, not derived from the token)', async () => {
    const { storage } = makeStorage({ [PROVIDER]: oauthCred('r1', 'a1', PAST) });
    const [entry] = storage.listAccounts(PROVIDER);
    expect(entry).toBeDefined();

    vi.spyOn(anthropicOAuthProvider, 'refreshToken').mockResolvedValue({
      refresh: 'r1-rotated',
      access: 'a1-rotated',
      expires: FUTURE,
    });

    await storage.getApiKey(PROVIDER);
    storage.reload();

    const accounts = storage.listAccounts(PROVIDER);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ id: entry!.id, refresh: 'r1-rotated', access: 'a1-rotated' });
    // Under the pre-A13 scheme the id was sha256(refresh).slice(0,8): refreshing
    // silently left the id describing a credential the account no longer held.
    expect(accounts[0]!.id).not.toBe(
      `${PROVIDER}:${createHash('sha256').update('r1-rotated').digest('hex').slice(0, 8)}`,
    );
  });

  it('A13: adds a subscription identity when the provider exposes one, and re-authorization matches on it', async () => {
    const { storage } = makeStorage();

    // openai-codex reads a stable account id off the credentials.
    const first = await storage.addAccount(
      CODEX,
      { refresh: 'cr1', access: 'ca1', expires: FUTURE, accountId: 'acct-A' },
      { label: 'A' },
    );
    expect(first.identity).toBe('acct-A');

    // Re-authorization returns a rotated token but the same subscription.
    await storage.addAccount(CODEX, {
      refresh: 'cr1-rotated',
      access: 'ca1-new',
      expires: FUTURE,
      accountId: 'acct-A',
    });

    const accounts = storage.listAccounts(CODEX);
    expect(accounts).toHaveLength(1); // same subscription, not a second account
    expect(accounts[0]).toMatchObject({ id: first.id, identity: 'acct-A', refresh: 'cr1-rotated' });

    // A genuinely different subscription is still a new account.
    await storage.addAccount(CODEX, { refresh: 'cr2', access: 'ca2', expires: FUTURE, accountId: 'acct-B' });
    expect(storage.listAccounts(CODEX)).toHaveLength(2);
  });

  it('A13: backfills the subscription identity of a pre-A13 registry without re-keying it', async () => {
    const legacyId = `${CODEX}:${createHash('sha256').update('cr1').digest('hex').slice(0, 8)}`;
    const { storage, authPath } = makeStorage({
      [CODEX]: oauthCred('cr1', 'ca1'),
      [`accounts:${legacyId}`]: {
        ...accountRecord('cr1', 'ca1', { active: true }),
        id: legacyId,
        accountId: 'acct-A',
      },
    });

    const [entry] = storage.listAccounts(CODEX);
    // The id is left exactly as it was: ids derive from nothing, so re-keying
    // would only invalidate references persisted outside auth.json.
    expect(entry!.id).toBe(legacyId);
    expect(entry!.identity).toBe('acct-A');
    // Backfilled durably, so it holds across a restart.
    expect(readAuthJson(authPath)[`accounts:${legacyId}`]).toMatchObject({ identity: 'acct-A' });

    // And the backfilled identity makes a later re-authorization update the
    // entry rather than register a second account for the subscription.
    await storage.addAccount(CODEX, {
      refresh: 'cr1-rotated',
      access: 'ca1-new',
      expires: FUTURE,
      accountId: 'acct-A',
    });
    expect(storage.listAccounts(CODEX)).toHaveLength(1);
    expect(storage.listAccounts(CODEX)[0]!.id).toBe(legacyId);
  });
});
