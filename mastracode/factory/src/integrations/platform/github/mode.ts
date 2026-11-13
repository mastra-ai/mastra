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
  /** The legacy installation whose storage row was re-pointed here, if any. */
  legacyInstallationId?: number;
}

export interface PlatformGithubModeRecord {
  version: 1;
  mode: PlatformGithubMode;
  /** Epoch ms of the switch. `github-app` events from before it still run. */
  switchedAt?: number;
  switchedBy?: string;
  installations?: PlatformGithubConnectInstallation[];
}

type ModeIndex = { version: 1; installations: Record<string, string> };

export type PlatformGithubModeStorage = IntegrationStorageHandle<
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>
>;

/** Settings user the per-org mode record is stored under. */
const MODE_USER_ID = '__platform_github_mode__';
/** Settings row (org, user) holding the deployment-wide installation → org index. */
const INDEX_ORG_ID = '__platform_github__';
const INDEX_USER_ID = '__connect_installations__';

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
  #index: { installations: Map<number, string>; at: number } | undefined;

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

  /** The org that switched to this `factory-github` installation, if any. */
  async orgForInstallation(installationId: number): Promise<string | undefined> {
    if (!this.#index || this.#now() - this.#index.at >= this.#cacheTtlMs) {
      const stored = (await this.#storage().settings.get(INDEX_ORG_ID, INDEX_USER_ID)) as Partial<ModeIndex> | null;
      const installations = new Map(
        Object.entries(stored?.installations ?? {}).flatMap(([id, orgId]) =>
          typeof orgId === 'string' && Number.isSafeInteger(Number(id)) ? [[Number(id), orgId] as const] : [],
        ),
      );
      this.#index = { installations, at: this.#now() };
    }
    return this.#index.installations.get(installationId);
  }

  /** Records the org's switch to `connect`, and indexes its installations. */
  async saveConnect(
    orgId: string,
    record: Required<Pick<PlatformGithubModeRecord, 'switchedAt' | 'installations'>> & { switchedBy?: string },
  ): Promise<PlatformGithubModeRecord> {
    const next: PlatformGithubModeRecord = { version: 1, mode: 'connect', ...record };
    const storage = this.#storage();
    const index = (await storage.settings.get(INDEX_ORG_ID, INDEX_USER_ID)) as Partial<ModeIndex> | null;
    const installations = { ...(index?.installations ?? {}) };
    for (const installation of record.installations) installations[String(installation.installationId)] = orgId;
    await storage.settings.save(INDEX_ORG_ID, INDEX_USER_ID, { version: 1, installations } satisfies ModeIndex);
    await storage.settings.save(orgId, MODE_USER_ID, { ...next });
    this.#cache.set(orgId, { record: next, at: this.#now() });
    this.#index = undefined;
    return next;
  }

  /** Drops cached records, so the next read goes to storage. */
  invalidate(orgId?: string): void {
    if (orgId) this.#cache.delete(orgId);
    else this.#cache.clear();
    this.#index = undefined;
  }
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
