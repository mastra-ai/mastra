/**
 * Credential storage for API keys and OAuth tokens.
 * Handles loading, saving, and refreshing credentials from auth.json.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getAppDataDir } from '../utils/project.js';
import { anthropicOAuthProvider } from './providers/anthropic.js';
import { githubCopilotOAuthProvider } from './providers/github-copilot.js';
import { kimiCodingOAuthProvider } from './providers/kimi-coding.js';
import { openaiCodexOAuthProvider } from './providers/openai-codex.js';
import { xaiOAuthProvider } from './providers/xai.js';
import type {
  AuthCredential,
  AuthStorageData,
  OAuthAccountRecord,
  OAuthCredential,
  OAuthCredentials,
  OAuthLoginCallbacks,
  OAuthProviderId,
  OAuthProviderInterface,
} from './types.js';

/**
 * Best/default models for each OAuth provider.
 * Used when auto-selecting a model after login.
 */
export const PROVIDER_DEFAULT_MODELS: Record<OAuthProviderId, string> = {
  anthropic: 'anthropic/claude-fable-5',
  'openai-codex': 'openai/gpt-5.6-sol',
  // gpt-4.1 routes through `/chat/completions` (which our OpenAI-compatible
  // adapter handles); Anthropic-shaped Copilot models (Claude on `/v1/messages`)
  // are not yet wired up, so picking one as the post-login default would error.
  'github-copilot': 'github-copilot/gpt-4.1',
  'kimi-for-coding': 'kimi-for-coding/kimi-for-coding',
  xai: 'xai/grok-4.5',
};

// Provider registry
const oauthProviderRegistry = new Map<string, OAuthProviderInterface>([
  [anthropicOAuthProvider.id, anthropicOAuthProvider],
  [openaiCodexOAuthProvider.id, openaiCodexOAuthProvider],
  [githubCopilotOAuthProvider.id, githubCopilotOAuthProvider],
  [kimiCodingOAuthProvider.id, kimiCodingOAuthProvider],
  [xaiOAuthProvider.id, xaiOAuthProvider],
]);

/**
 * Get an OAuth provider by ID
 */
export function getOAuthProvider(id: OAuthProviderId): OAuthProviderInterface | undefined {
  return oauthProviderRegistry.get(id);
}

/**
 * Get all registered OAuth providers
 */
export function getOAuthProviders(): OAuthProviderInterface[] {
  return Array.from(oauthProviderRegistry.values());
}

/** Stable instance id for an OAuth account: `${providerId}:${sha256(refresh).slice(0,8)}`. */
function accountIdFor(providerId: string, refreshToken: string): string {
  return `${providerId}:${createHash('sha256').update(refreshToken).digest('hex').slice(0, 8)}`;
}

function isOAuthAccountRecord(value: unknown): value is OAuthAccountRecord {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<OAuthAccountRecord>;
  return (
    v.type === 'oauth-account' &&
    typeof v.id === 'string' &&
    typeof v.label === 'string' &&
    typeof v.addedAt === 'string' &&
    typeof v.active === 'boolean' &&
    typeof v.refresh === 'string' &&
    typeof v.access === 'string' &&
    typeof v.expires === 'number'
  );
}

/** The credential fields of an account record — everything but registry identity. */
function credentialFieldsOf(record: OAuthAccountRecord): OAuthCredentials {
  const { type: _type, id: _id, label: _label, addedAt: _addedAt, active: _active, ...creds } = record;
  return creds;
}

/**
 * Credential storage backed by a JSON file.
 */
export class AuthStorage {
  private data: AuthStorageData = {};
  private refreshPromises = new Map<string, Promise<string | undefined>>();

  constructor(private authPath: string = join(getAppDataDir(), 'auth.json')) {
    this.reload();
  }

  /**
   * Reload credentials from disk.
   */
  reload(): void {
    if (!existsSync(this.authPath)) {
      this.data = {};
      return;
    }
    try {
      this.data = JSON.parse(readFileSync(this.authPath, 'utf-8'));
    } catch {
      this.data = {};
    }
    this.migrate();
  }

  /**
   * Bring auth.json up to the multi-account registry format. Runs on every
   * load; saves only when something actually changed.
   *
   * 1. A legacy OAuth slot with no registry gets one adopted active entry
   *    (the slot's tokens stay put — the entry mirrors them).
   * 2. When the slot's refresh token differs from the active entry's, an
   *    external writer (older build, another worktree) owns the slot — the
   *    slot wins and its tokens are adopted onto the active entry.
   * 3. A registry with no active entry (hand-edited) self-heals to its first
   *    entry; malformed `accounts:` values are skipped, never fatal.
   */
  private migrate(): void {
    let changed = false;
    for (const key of Object.keys(this.data)) {
      const slot = this.data[key];
      if (!slot || slot.type !== 'oauth') continue;
      const providerId = key;
      const entries = this.accountEntries(providerId);
      if (entries.length === 0) {
        this.adoptSlot(providerId, slot);
        changed = true;
        continue;
      }
      const active = entries.find(entry => entry.active);
      if (!active) {
        this.data[this.accountKeyFor(entries[0]!.id)] = { ...entries[0]!, active: true };
        changed = true;
        continue;
      }
      if (active.refresh !== slot.refresh) {
        const { type: _type, ...slotCreds } = slot;
        this.data[this.accountKeyFor(active.id)] = { ...active, ...slotCreds, type: 'oauth-account' };
        changed = true;
      }
    }
    if (changed) this.save();
  }

  /**
   * Save credentials to disk.
   */
  private save(): void {
    const dir = dirname(this.authPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    writeFileSync(this.authPath, JSON.stringify(this.data, null, 2), 'utf-8');
    chmodSync(this.authPath, 0o600);
  }

  /**
   * Get credential for a provider. Registry entries (type 'oauth-account')
   * live under `accounts:` keys and never surface here.
   */
  get(provider: string): AuthCredential | undefined {
    const cred = this.data[provider];
    return cred !== undefined && cred.type !== 'oauth-account' ? cred : undefined;
  }

  /**
   * Set credential for a provider.
   */
  set(provider: string, credential: AuthCredential): void {
    this.data[provider] = credential;
    this.save();
  }

  /**
   * Remove credential for a provider.
   */
  remove(provider: string): void {
    delete this.data[provider];
    this.save();
  }

  /**
   * List all providers with credentials.
   */
  list(): string[] {
    return Object.keys(this.data);
  }

  /**
   * Check if credentials exist for a provider.
   */
  has(provider: string): boolean {
    return provider in this.data;
  }

  /**
   * Check if logged in via OAuth for a provider.
   */
  isLoggedIn(provider: string): boolean {
    const cred = this.data[provider];
    return cred?.type === 'oauth';
  }

  /**
   * Check if a stored API key exists for a provider.
   * Keys are stored under `apikey:<provider>` in auth.json.
   */
  hasStoredApiKey(provider: string): boolean {
    const cred = this.data[`apikey:${provider}`];
    return cred?.type === 'api_key' && cred.key.length > 0;
  }

  /**
   * Get a stored API key for a provider, if any.
   */
  getStoredApiKey(provider: string): string | undefined {
    const cred = this.data[`apikey:${provider}`];
    return cred?.type === 'api_key' && cred.key.length > 0 ? cred.key : undefined;
  }

  /**
   * Store an API key for a provider.
   * Also sets the corresponding environment variable so model resolution can find it.
   */
  setStoredApiKey(provider: string, key: string, envVar?: string): void {
    this.set(`apikey:${provider}`, { type: 'api_key', key });
    if (envVar) {
      process.env[envVar] = key;
    }
  }

  /**
   * Load all stored API keys into process.env.
   * Called at startup so model resolution can find stored keys.
   * Only sets env vars that aren't already set (env vars take precedence).
   */
  loadStoredApiKeysIntoEnv(providerEnvVars: Record<string, string | undefined>): void {
    for (const [key, cred] of Object.entries(this.data)) {
      if (!key.startsWith('apikey:') || cred.type !== 'api_key' || !cred.key) continue;
      const provider = key.substring('apikey:'.length);
      const envVar = providerEnvVars[provider];
      if (envVar && !process.env[envVar]) {
        process.env[envVar] = cred.key;
      }
    }
  }

  /**
   * Login to an OAuth provider.
   */
  async login(providerId: OAuthProviderId, callbacks: OAuthLoginCallbacks): Promise<void> {
    const provider = getOAuthProvider(providerId);
    if (!provider) {
      throw new Error(`Unknown OAuth provider: ${providerId}`);
    }

    const credentials = await provider.login(callbacks);
    // Route through the account registry: a legacy slot credential is adopted
    // first, the new account is appended (or updated in place on id
    // collision), and it becomes the active account.
    await this.addAccount(providerId, credentials);
  }

  /**
   * Logout from a provider: remove the legacy slot and every registered account.
   */
  logout(provider: string): void {
    this.reload();
    delete this.data[provider];
    const prefix = this.accountPrefixFor(provider);
    for (const key of Object.keys(this.data)) {
      if (key.startsWith(prefix)) delete this.data[key];
    }
    this.save();
  }

  // ---------------------------------------------------------------------------
  // Multi-account registry
  // ---------------------------------------------------------------------------

  private accountPrefixFor(providerId: string): string {
    return `accounts:${providerId}:`;
  }

  private accountKeyFor(id: string): string {
    return `accounts:${id}`;
  }

  /** Registry entries for a provider in JSON insertion order (malformed values skipped). */
  private accountEntries(providerId: string): OAuthAccountRecord[] {
    const prefix = this.accountPrefixFor(providerId);
    const out: OAuthAccountRecord[] = [];
    for (const [key, value] of Object.entries(this.data)) {
      if (key.startsWith(prefix) && isOAuthAccountRecord(value)) out.push(value);
    }
    return out;
  }

  /** Adopt a legacy slot credential as the registry's first active entry. */
  private adoptSlot(providerId: string, slot: OAuthCredential): OAuthAccountRecord {
    const id = accountIdFor(providerId, slot.refresh);
    const provider = getOAuthProvider(providerId);
    const record: OAuthAccountRecord = {
      ...slot,
      type: 'oauth-account',
      id,
      label: `${provider?.name ?? providerId} account 1`,
      addedAt: new Date().toISOString(),
      active: true,
    };
    this.data[this.accountKeyFor(id)] = record;
    return record;
  }

  /**
   * Registered OAuth accounts for a provider, in insertion order.
   */
  listAccounts(providerId: string): OAuthAccountRecord[] {
    return this.accountEntries(providerId);
  }

  /**
   * The provider's active registry entry, if a registry exists.
   */
  getActiveAccount(providerId: string): OAuthAccountRecord | undefined {
    return this.accountEntries(providerId).find(entry => entry.active);
  }

  /**
   * Register OAuth credentials as an account for a provider, making it active.
   *
   * A legacy slot credential not matching any registry entry is adopted as the
   * first entry first. When the new credentials hash to an existing entry's
   * id, that entry's tokens are updated in place (re-authentication — label
   * and position preserved); otherwise a new entry is appended and activated.
   */
  async addAccount(providerId: string, creds: OAuthCredentials, label?: string): Promise<OAuthAccountRecord> {
    this.reload();
    const entries = this.accountEntries(providerId);

    const slot = this.data[providerId];
    if (slot?.type === 'oauth' && !entries.some(entry => entry.refresh === slot.refresh)) {
      entries.push(this.adoptSlot(providerId, slot));
    }

    const id = accountIdFor(providerId, creds.refresh);
    const existing = entries.find(entry => entry.id === id);
    if (existing) {
      this.data[this.accountKeyFor(id)] = { ...existing, ...creds, type: 'oauth-account', id, active: existing.active };
    } else {
      const provider = getOAuthProvider(providerId);
      const resolvedLabel =
        label ??
        (await provider?.getAccountLabel?.(creds)) ??
        `${provider?.name ?? providerId} account ${entries.length + 1}`;
      this.data[this.accountKeyFor(id)] = {
        type: 'oauth-account',
        id,
        label: resolvedLabel,
        addedAt: new Date().toISOString(),
        active: false,
        ...creds,
      };
    }

    const activated = this.activateInMemory(providerId, id);
    if (!activated) {
      throw new Error(`Failed to activate account ${id} for provider ${providerId}`);
    }
    this.save();
    return activated;
  }

  /**
   * Activate an account: move the active tokens out of the legacy slot back
   * into the previously active entry, and the target's tokens into the slot
   * (never copy — one home per token set). With no `instanceId`, rotate to
   * the next entry in insertion order, wrapping once to the front; returns
   * undefined when there is no other entry to rotate to.
   */
  activateAccount(providerId: string, instanceId?: string): OAuthAccountRecord | undefined {
    this.reload();
    const activated = this.activateInMemory(providerId, instanceId);
    if (activated) this.save();
    return activated;
  }

  /**
   * Activate an account in memory only — the caller owns reload/save. Move the
   * active tokens out of the legacy slot back into the previously active
   * entry, and the target's tokens into the slot (never copy — one home per
   * token set). With no `instanceId`, rotate to the next entry in insertion
   * order, wrapping once to the front; returns undefined when there is no
   * other entry to rotate to.
   */
  private activateInMemory(providerId: string, instanceId?: string): OAuthAccountRecord | undefined {
    const entries = this.accountEntries(providerId);
    if (entries.length === 0) return undefined;

    let target: OAuthAccountRecord | undefined;
    if (instanceId !== undefined) {
      target = entries.find(entry => entry.id === instanceId);
      if (!target) return undefined;
    } else {
      if (entries.length <= 1) return undefined;
      const currentIdx = entries.findIndex(entry => entry.active);
      const candidates =
        currentIdx >= 0 ? [...entries.slice(currentIdx + 1), ...entries.slice(0, currentIdx)] : [...entries];
      target = candidates[0]!;
    }
    if (!target) return undefined;

    const slot = this.data[providerId];
    const current = entries.find(entry => entry.active && entry.id !== target.id);

    // Move the slot's tokens back onto the previously active entry. Skipped
    // when the target is already active — its (possibly re-authenticated)
    // entry already holds the freshest tokens.
    if (current && slot?.type === 'oauth') {
      const { type: _type, ...slotCreds } = slot;
      this.data[this.accountKeyFor(current.id)] = { ...current, ...slotCreds, type: 'oauth-account', active: false };
    }

    // Move the target's tokens into the legacy slot, preserving any extra
    // slot fields the target's credential does not carry.
    const base = slot?.type === 'oauth' ? slot : {};
    this.data[providerId] = { ...base, ...credentialFieldsOf(target), type: 'oauth' };

    // Exactly the target stays active (self-heals multi-active states).
    this.data[this.accountKeyFor(target.id)] = { ...target, active: true };
    for (const entry of entries) {
      if (entry.id === target.id || entry.id === current?.id) continue;
      if (entry.active) {
        this.data[this.accountKeyFor(entry.id)] = { ...entry, active: false };
      }
    }

    return { ...target, active: true };
  }

  /**
   * Remove an account from the registry. If it was active, the next entry in
   * insertion order is activated; when it was the last one, the legacy slot
   * is removed too (full sign-out for that provider).
   */
  removeAccount(providerId: string, instanceId: string): void {
    this.reload();
    const entries = this.accountEntries(providerId);
    const target = entries.find(entry => entry.id === instanceId);
    if (!target) return;

    const wasActive = target.active;
    delete this.data[this.accountKeyFor(instanceId)];

    if (wasActive) {
      const idx = entries.indexOf(target);
      const next = entries[idx + 1] ?? entries.find(entry => entry.id !== instanceId);
      if (next) {
        // The removed account's tokens die with it — only move tokens in.
        this.data[providerId] = { type: 'oauth', ...credentialFieldsOf(next) };
        this.data[this.accountKeyFor(next.id)] = { ...next, active: true };
        for (const entry of entries) {
          if (entry.id === next.id || entry.id === instanceId) continue;
          if (entry.active) {
            this.data[this.accountKeyFor(entry.id)] = { ...entry, active: false };
          }
        }
      } else {
        delete this.data[providerId];
      }
    }

    this.save();
  }

  /**
   * Rename an account's label.
   */
  renameAccount(providerId: string, instanceId: string, label: string): void {
    this.reload();
    const key = this.accountKeyFor(instanceId);
    const entry = this.data[key];
    if (!isOAuthAccountRecord(entry)) return;
    this.data[key] = { ...entry, label };
    this.save();
  }

  /**
   * Persist refreshed credentials for the currently active account into both
   * homes — the legacy slot and the active registry entry (the slot is the
   * home while active; the entry mirrors it so a later activation has fresh
   * tokens to move back).
   */
  private persistActiveCredential(providerId: string, creds: OAuthCredentials): void {
    this.reload();
    const slot = this.data[providerId];
    this.data[providerId] = slot?.type === 'oauth' ? { ...slot, ...creds, type: 'oauth' } : { type: 'oauth', ...creds };
    const active = this.getActiveAccount(providerId);
    if (active) {
      this.data[this.accountKeyFor(active.id)] = { ...active, ...creds, type: 'oauth-account' };
    }
    this.save();
  }

  /**
   * Get API key for a provider, auto-refreshing OAuth tokens if needed.
   * On refresh failure of the active account, rotates through the provider's
   * remaining registered accounts before giving up (restoring the original).
   */
  async getApiKey(providerId: string): Promise<string | undefined> {
    const cred = this.data[providerId];

    if (cred?.type === 'api_key') {
      return cred.key;
    }

    if (cred?.type === 'oauth') {
      const provider = getOAuthProvider(providerId);
      if (!provider) {
        return undefined;
      }

      if (Date.now() < cred.expires) {
        return provider.getApiKey(cred);
      }

      // Share one refresh when concurrent requests observe the same expired
      // token (keyed per account instance once a registry exists).
      const activeEntry = this.getActiveAccount(providerId);
      const refreshKey = `${providerId}:${activeEntry?.id ?? providerId}`;
      const pendingRefresh = this.refreshPromises.get(refreshKey);
      if (pendingRefresh) return pendingRefresh;

      const refresh = (async () => {
        try {
          const newCreds = await provider.refreshToken(cred);
          this.persistActiveCredential(providerId, newCreds);
          return provider.getApiKey(newCreds);
        } catch {
          // Refresh failed. Rotate through the pool: try each remaining
          // account — refreshing an expired sibling first — and only fail
          // when every instance has, restoring the originally active account
          // (the credential is kept, nothing deleted — same as the
          // single-account behavior).
          const pool = this.listAccounts(providerId);
          if (activeEntry && pool.length > 1) {
            for (const candidate of pool) {
              if (candidate.id === activeEntry.id) continue;
              const activated = this.activateAccount(providerId, candidate.id);
              if (!activated) continue;
              const slotCred = this.get(providerId);
              if (slotCred?.type !== 'oauth') continue;
              let creds: OAuthCredentials = slotCred;
              if (Date.now() >= creds.expires) {
                try {
                  creds = await provider.refreshToken(creds);
                  this.persistActiveCredential(providerId, creds);
                } catch {
                  continue;
                }
              }
              return provider.getApiKey(creds);
            }
            this.activateAccount(providerId, activeEntry.id);
          }
          return undefined;
        }
      })();
      this.refreshPromises.set(refreshKey, refresh);
      try {
        return await refresh;
      } finally {
        this.refreshPromises.delete(refreshKey);
      }
    }

    return undefined;
  }
}
