import type { ConnectClient } from '@mastra/connect';
import type { FactoryStorage } from '@mastra/core/storage';
import { Octokit } from '@octokit/rest';

import type { IntegrationStorage } from '../../../storage/domains/integrations/base.js';
import type {
  SourceControlInstallationLinks,
  SourceControlInstallationMove,
  SourceControlInstallationMoveConflict,
  SourceControlStorage,
} from '../../../storage/domains/source-control/base.js';
import type { PlatformConnection } from '../foundation/connect-binding.js';
import { platformErrorMessage } from '../platform-connect.js';
import { FACTORY_GITHUB_PROVIDER_KEY, FACTORY_REVIEWS_GITHUB_PROVIDER_KEY } from './connect-events.js';
import type { GithubConnectTokens } from './connect-tokens.js';
import { PlatformGithubModes } from './mode.js';
import type { PlatformGithubConnectInstallation, PlatformGithubModeRecord, PlatformGithubModeStorage } from './mode.js';

export type FactoryGithubApp = typeof FACTORY_GITHUB_PROVIDER_KEY | typeof FACTORY_REVIEWS_GITHUB_PROVIDER_KEY;

/** What one Mastra Factory app connection reaches on GitHub. */
export interface GithubAppInstallationScan {
  connectionId: string;
  app: FactoryGithubApp;
  installationId: number | null;
  accountLogin: string | null;
  accountType: string | null;
  /** GitHub repository ids the installation can reach. */
  repositoryIds: ReadonlySet<string>;
  /** Why the installation could not be read, when it couldn't. */
  error?: string;
}

/** What stands between an org and the switch. Everything empty means it can switch. */
export interface GithubSwitchMissing {
  /** Apps with no active connection at all. */
  apps: FactoryGithubApp[];
  /** Accounts the org's repositories come from that an app is not installed on. */
  accounts: Array<{ accountLogin: string; apps: FactoryGithubApp[] }>;
  /** Repositories linked to a project that an app's installation can't reach. */
  repositories: Array<{ slug: string; githubRepositoryId: string; accountLogin: string; apps: FactoryGithubApp[] }>;
  /** App connections whose installation could not be read. */
  unreadable: Array<{ connectionId: string; app: FactoryGithubApp; message: string }>;
}

export interface GithubSwitchPlan {
  ready: boolean;
  missing: GithubSwitchMissing;
  /** The installations the org records at the switch: every account both apps are installed on. */
  installations: PlatformGithubConnectInstallation[];
  /** The storage moves the switch makes. */
  moves: SourceControlInstallationMove[];
}

const APPS: FactoryGithubApp[] = [FACTORY_GITHUB_PROVIDER_KEY, FACTORY_REVIEWS_GITHUB_PROVIDER_KEY];

/**
 * Plans an org's switch from the legacy app to the Mastra Factory apps. Each
 * account the org has a legacy installation on needs both apps installed,
 * and both installations must reach every repository linked to a project,
 * matched by GitHub repository id.
 */
export function planGithubSwitch(input: {
  scans: readonly GithubAppInstallationScan[];
  legacy: readonly SourceControlInstallationLinks[];
}): GithubSwitchPlan {
  const missing: GithubSwitchMissing = { apps: [], accounts: [], repositories: [], unreadable: [] };
  const byAccount = new Map<FactoryGithubApp, Map<string, GithubAppInstallationScan>>(
    APPS.map(app => [app, new Map()]),
  );
  for (const scan of input.scans) {
    if (scan.error !== undefined || scan.installationId === null || !scan.accountLogin) {
      missing.unreadable.push({
        connectionId: scan.connectionId,
        app: scan.app,
        message: scan.error ?? 'The installation behind this connection could not be identified.',
      });
      continue;
    }
    byAccount.get(scan.app)!.set(scan.accountLogin.toLowerCase(), scan);
  }
  for (const app of APPS) {
    if (!input.scans.some(scan => scan.app === app)) missing.apps.push(app);
  }

  const installations: PlatformGithubConnectInstallation[] = [];
  for (const [account, github] of byAccount.get(FACTORY_GITHUB_PROVIDER_KEY)!) {
    const reviews = byAccount.get(FACTORY_REVIEWS_GITHUB_PROVIDER_KEY)!.get(account);
    if (!reviews) continue;
    installations.push({
      accountLogin: github.accountLogin!,
      ...(github.accountType ? { accountType: github.accountType } : {}),
      installationId: github.installationId!,
      connectionId: github.connectionId,
      reviewsConnectionId: reviews.connectionId,
    });
  }

  const legacyByAccount = new Map<string, { accountLogin: string; rows: SourceControlInstallationLinks[] }>();
  for (const row of input.legacy) {
    const accountLogin = legacyAccount(row);
    const key = accountLogin.toLowerCase();
    const entry = legacyByAccount.get(key) ?? { accountLogin, rows: [] };
    entry.rows.push(row);
    legacyByAccount.set(key, entry);
  }

  const moves: SourceControlInstallationMove[] = [];
  for (const [key, { accountLogin, rows }] of legacyByAccount) {
    const scans = APPS.map(app => byAccount.get(app)!.get(key));
    const absent = APPS.filter((_, index) => !scans[index]);
    if (absent.length > 0) missing.accounts.push({ accountLogin, apps: absent });
    for (const row of rows) {
      for (const repository of row.linkedRepositories) {
        const unreachable = APPS.filter((_, index) => !scans[index]?.repositoryIds.has(repository.externalId));
        if (unreachable.length > 0) {
          missing.repositories.push({
            slug: repository.slug,
            githubRepositoryId: repository.externalId,
            accountLogin,
            apps: unreachable,
          });
        }
      }
    }
    const installation = installations.find(candidate => candidate.accountLogin.toLowerCase() === key);
    if (!installation) continue;
    const legacyInstallationIds = rows
      .map(row => Number(row.installation.externalId))
      .filter(id => Number.isSafeInteger(id) && id !== installation.installationId);
    if (legacyInstallationIds.length > 0) installation.legacyInstallationIds = legacyInstallationIds;
    moves.push({
      externalId: String(installation.installationId),
      installationIds: rows.map(row => row.installation.id),
      accountName: installation.accountLogin,
      ...(installation.accountType ? { accountType: installation.accountType } : {}),
    });
  }

  const ready =
    missing.apps.length === 0 &&
    missing.accounts.length === 0 &&
    missing.repositories.length === 0 &&
    missing.unreadable.length === 0;
  return { ready, missing, installations, moves };
}

/** The account a legacy installation row belongs to: its recorded name, else its repositories' owner. */
function legacyAccount(row: SourceControlInstallationLinks): string {
  if (row.installation.accountName) return row.installation.accountName;
  const owner = row.linkedRepositories[0]?.slug.split('/')[0];
  return owner || `installation ${row.installation.externalId}`;
}

/** An app connection's state, as the switch card shows it. */
export interface GithubSwitchConnection {
  id: string;
  app: FactoryGithubApp;
  status: PlatformConnection['status'];
  accountLogin: string | null;
}

export interface GithubSwitchStatus {
  mode: PlatformGithubModeRecord['mode'];
  switchedAt: number | null;
  connections: GithubSwitchConnection[];
  /** Absent once the org has switched. */
  plan?: GithubSwitchPlan;
}

export type GithubSwitchResult =
  | { status: 'switched'; record: PlatformGithubModeRecord; plan: GithubSwitchPlan }
  | { status: 'already_switched'; record: PlatformGithubModeRecord }
  | { status: 'blocked'; plan: GithubSwitchPlan }
  | { status: 'conflict'; conflicts: SourceControlInstallationMoveConflict[] };

/** How often a switched org's installations are re-read from the apps. */
const REFRESH_INTERVAL_MS = 5 * 60_000;

export interface PlatformGithubSwitchOptions {
  integrationId: string;
  connect: ConnectClient;
  tokens: Pick<GithubConnectTokens, 'installationToken'>;
  /** The project's app connections, read fresh. */
  listConnections: () => Promise<PlatformConnection[]>;
  modes: PlatformGithubModes;
  githubApiUrl?: string;
  now?: () => number;
}

/**
 * Moves an org from the legacy GitHub App to the Mastra Factory apps. The
 * preconditions are checked before the transaction and again inside it,
 * against rows read under lock, so a repository linked in between can't be
 * left behind and two switches can't both move the same installations.
 */
export class PlatformGithubSwitch {
  readonly #options: PlatformGithubSwitchOptions;
  readonly #refreshedAt = new Map<string, number>();

  constructor(options: PlatformGithubSwitchOptions) {
    this.#options = options;
  }

  async status(storage: FactoryStorage, orgId: string): Promise<GithubSwitchStatus> {
    const [record, connections] = await Promise.all([this.#options.modes.get(orgId), this.#appConnections()]);
    const base = {
      mode: record.mode,
      switchedAt: record.switchedAt ?? null,
      connections: connections.map(connection => ({
        id: connection.id,
        app: connection.integrationId as FactoryGithubApp,
        status: connection.status,
        accountLogin: connection.accountLabel,
      })),
    };
    if (record.mode === 'connect') return base;
    const scans = await this.#scan(connections);
    const legacy = await this.#sourceControl(storage).installationsWithLinkedRepositories(storage.ops, {
      integrationId: this.#options.integrationId,
      orgId,
    });
    return { ...base, plan: planGithubSwitch({ scans, legacy }) };
  }

  async switch(storage: FactoryStorage, input: { orgId: string; userId: string }): Promise<GithubSwitchResult> {
    const current = await this.#options.modes.get(input.orgId);
    if (current.mode === 'connect') return { status: 'already_switched', record: current };
    const scans = await this.#scan(await this.#appConnections());
    const sourceControl = this.#sourceControl(storage);
    const scope = { integrationId: this.#options.integrationId, orgId: input.orgId };
    const precheck = planGithubSwitch({
      scans,
      legacy: await sourceControl.installationsWithLinkedRepositories(storage.ops, scope),
    });
    if (!precheck.ready) return { status: 'blocked', plan: precheck };

    const integrations = storage.getDomain<IntegrationStorage>('integrations');
    const result = await storage.withTransaction(async (ops): Promise<GithubSwitchResult> => {
      const legacy = await sourceControl.installationsWithLinkedRepositories(ops, { ...scope, lock: true });
      const modes = new PlatformGithubModes(
        () => integrations.forIntegration(this.#options.integrationId, ops) as unknown as PlatformGithubModeStorage,
        { cacheTtlMs: 0 },
      );
      const record = await modes.get(input.orgId);
      if (record.mode === 'connect') return { status: 'already_switched', record };
      const plan = planGithubSwitch({ scans, legacy });
      if (!plan.ready) return { status: 'blocked', plan };
      const { conflicts } = await sourceControl.moveInstallations(ops, { ...scope, moves: plan.moves });
      if (conflicts.length > 0) return { status: 'conflict', conflicts };
      const saved = await modes.saveConnect(input.orgId, {
        switchedAt: (this.#options.now ?? Date.now)(),
        switchedBy: input.userId,
        installations: plan.installations,
      });
      return { status: 'switched', record: saved, plan };
    });
    this.#options.modes.invalidate(input.orgId);
    if (result.status === 'switched') {
      sourceControl.linkedRepositoriesChanged({ integrationId: this.#options.integrationId, local: true });
    }
    return result;
  }

  /**
   * Records the accounts both apps were installed on since a switched org's
   * switch, and a reconnected installation's new connections. Never removes
   * one: an uninstalled app's installation fails as inactive instead.
   * Re-reads at most every few minutes per org; returns the record in force.
   */
  async refresh(orgId: string): Promise<PlatformGithubModeRecord> {
    const record = await this.#options.modes.get(orgId);
    const now = (this.#options.now ?? Date.now)();
    if (record.mode !== 'connect' || now - (this.#refreshedAt.get(orgId) ?? -Infinity) < REFRESH_INTERVAL_MS) {
      return record;
    }
    this.#refreshedAt.set(orgId, now);
    const { installations: found } = planGithubSwitch({
      scans: await this.#scan(await this.#appConnections()),
      legacy: [],
    });
    const recorded = record.installations ?? [];
    const merged = recorded.map(installation => {
      const current = found.find(candidate => candidate.installationId === installation.installationId);
      return current
        ? { ...installation, connectionId: current.connectionId, reviewsConnectionId: current.reviewsConnectionId }
        : installation;
    });
    for (const installation of found) {
      if (!recorded.some(candidate => candidate.installationId === installation.installationId))
        merged.push(installation);
    }
    const changed = merged.some((installation, index) => {
      const before = recorded[index];
      return (
        !before ||
        before.connectionId !== installation.connectionId ||
        before.reviewsConnectionId !== installation.reviewsConnectionId
      );
    });
    if (!changed || record.switchedAt === undefined) return record;
    return this.#options.modes.saveConnect(orgId, {
      switchedAt: record.switchedAt,
      ...(record.switchedBy ? { switchedBy: record.switchedBy } : {}),
      installations: merged,
    });
  }

  #sourceControl(storage: FactoryStorage): SourceControlStorage {
    return storage.getDomain<SourceControlStorage>('source-control');
  }

  async #appConnections(): Promise<PlatformConnection[]> {
    return (await this.#options.listConnections()).filter(
      connection =>
        connection.resourceId === null &&
        (connection.integrationId === FACTORY_GITHUB_PROVIDER_KEY ||
          connection.integrationId === FACTORY_REVIEWS_GITHUB_PROVIDER_KEY),
    );
  }

  /** Reads what each active app connection's installation is and reaches. */
  async #scan(connections: readonly PlatformConnection[]): Promise<GithubAppInstallationScan[]> {
    return Promise.all(
      connections.filter(connection => connection.status === 'active').map(connection => this.#scanOne(connection)),
    );
  }

  async #scanOne(connection: PlatformConnection): Promise<GithubAppInstallationScan> {
    const app = connection.integrationId as FactoryGithubApp;
    const empty = { connectionId: connection.id, app, repositoryIds: new Set<string>() };
    try {
      const [context, token] = await Promise.all([
        this.#options.connect.getContext(connection.id),
        this.#options.tokens.installationToken(connection.id),
      ]);
      const octokit = new Octokit({
        auth: token,
        request: { timeout: 15_000 },
        log: { debug: () => {}, info: () => {}, warn: console.warn, error: () => {} },
        ...(this.#options.githubApiUrl ? { baseUrl: this.#options.githubApiUrl } : {}),
      });
      const repositories = await octokit.paginate('GET /installation/repositories', { per_page: 100 });
      const owner = repositories[0]?.owner;
      return {
        ...empty,
        installationId: installationIdOf(context.connection_config?.installation_id),
        accountLogin: owner?.login ?? connection.accountLabel,
        accountType: owner?.type ?? null,
        repositoryIds: new Set(repositories.map(repository => String(repository.id))),
      };
    } catch (error) {
      return {
        ...empty,
        installationId: null,
        accountLogin: null,
        accountType: null,
        error: platformErrorMessage(error),
      };
    }
  }
}

function installationIdOf(value: unknown): number | null {
  const id = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
