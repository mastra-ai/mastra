import type { IntegrationStorageHandle } from '../../../storage/domains/integrations/base.js';

/** Which GitHub Apps an org's Platform GitHub runs on. */
export type PlatformGithubMode = 'legacy' | 'connect';

/** An installation of the Mastra Factory apps an org switched to. */
export interface PlatformGithubConnectInstallation {
  accountLogin: string;
  /** `Organization` or `User`, as GitHub reports the account. */
  accountType?: string;
  /** The `factory-github` installation id. */
  installationId: number;
  /** The `factory-github` Connect connection serving it. */
  connectionId: string;
  /** The `factory-reviews-github` Connect connection for the same account. */
  reviewsConnectionId: string;
  /** The legacy installations whose storage rows were moved here at the switch. */
  legacyInstallationIds?: number[];
}

export interface PlatformGithubModeRecord {
  version: 1;
  mode: PlatformGithubMode;
  /** Epoch ms of the switch. `github-app` events from before it still run. */
  switchedAt?: number;
  switchedBy?: string;
  installations?: PlatformGithubConnectInstallation[];
}

export type PlatformGithubModeStorage = IntegrationStorageHandle<
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>
>;

/** Settings user the per-org mode record is stored under. */
const MODE_USER_ID = '__platform_github_mode__';
/**
 * Settings org of the deployment-wide installation → org index. Each
 * installation has its own row, so two orgs switching at once never
 * overwrite each other's entries.
 */
const INDEX_ORG_ID = '__platform_github__';
const indexUserId = (installationId: number) => `__connect_installation__:${installationId}`;

const LEGACY: PlatformGithubModeRecord = { version: 1, mode: 'legacy' };
/** How long a read record is trusted, so a switch made on another replica is seen. */
const DEFAULT_CACHE_TTL_MS = 30_000;

/**
 * Each Factory org's Platform GitHub mode, stored in the integration's
 * settings. Orgs default to `legacy`. A switched org also records which
 * Mastra Factory app installations it switched to, indexed deployment-wide
 * so an operation that only names an installation finds its org.
 */
export class PlatformGithubModes {
  readonly #storage: () => PlatformGithubModeStorage;
  readonly #cacheTtlMs: number;
  readonly #now: () => number;
  readonly #cache = new Map<string, { record: PlatformGithubModeRecord; at: number }>();
  readonly #index = new Map<number, { orgIds: readonly string[]; at: number }>();

  constructor(storage: () => PlatformGithubModeStorage, options: { cacheTtlMs?: number; now?: () => number } = {}) {
    this.#storage = storage;
    this.#cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.#now = options.now ?? Date.now;
  }

  async get(orgId: string): Promise<PlatformGithubModeRecord> {
    const cached = this.#cache.get(orgId);
    if (cached && this.#now() - cached.at < this.#cacheTtlMs) return cached.record;
    const record = normalize(await this.#storage().settings.get(orgId, MODE_USER_ID));
    this.#cache.set(orgId, { record, at: this.#now() });
    return record;
  }

  async modeFor(orgId: string): Promise<PlatformGithubMode> {
    return (await this.get(orgId)).mode;
  }

  /**
   * The switched orgs that recorded this `factory-github` installation. Every
   * tenant sees the project's app connections, so more than one org can switch
   * to the same installation; callers that know their org pass it instead.
   */
  async orgsForInstallation(installationId: number): Promise<readonly string[]> {
    const cached = this.#index.get(installationId);
    if (cached && this.#now() - cached.at < this.#cacheTtlMs) return cached.orgIds;
    const orgIds = claims(await this.#storage().settings.get(INDEX_ORG_ID, indexUserId(installationId)));
    this.#index.set(installationId, { orgIds, at: this.#now() });
    return orgIds;
  }

  /** Records the org's switch to `connect`, and adds it to its installations' claims. */
  async saveConnect(
    orgId: string,
    record: Required<Pick<PlatformGithubModeRecord, 'switchedAt' | 'installations'>> & { switchedBy?: string },
  ): Promise<PlatformGithubModeRecord> {
    const next: PlatformGithubModeRecord = { version: 1, mode: 'connect', ...record };
    const storage = this.#storage();
    for (const installation of record.installations) {
      const key = indexUserId(installation.installationId);
      const orgIds = claims(await storage.settings.get(INDEX_ORG_ID, key));
      if (!orgIds.includes(orgId)) {
        await storage.settings.save(INDEX_ORG_ID, key, { version: 2, orgIds: [...orgIds, orgId].sort() });
      }
    }
    await storage.settings.save(orgId, MODE_USER_ID, { ...next });
    this.#cache.set(orgId, { record: next, at: this.#now() });
    for (const installation of record.installations) this.#index.delete(installation.installationId);
    return next;
  }

  /** Drops cached records, so the next read goes to storage. */
  invalidate(orgId?: string): void {
    if (orgId) this.#cache.delete(orgId);
    else this.#cache.clear();
    this.#index.clear();
  }
}

function claims(stored: Record<string, unknown> | null): readonly string[] {
  if (Array.isArray(stored?.orgIds)) return stored.orgIds.filter((id): id is string => typeof id === 'string');
  return typeof stored?.orgId === 'string' ? [stored.orgId] : [];
}

function normalize(stored: Record<string, unknown> | null): PlatformGithubModeRecord {
  if (!stored || stored.mode !== 'connect') return LEGACY;
  return {
    version: 1,
    mode: 'connect',
    ...(typeof stored.switchedAt === 'number' ? { switchedAt: stored.switchedAt } : {}),
    ...(typeof stored.switchedBy === 'string' ? { switchedBy: stored.switchedBy } : {}),
    installations: Array.isArray(stored.installations)
      ? (stored.installations as PlatformGithubConnectInstallation[])
      : [],
  };
}
