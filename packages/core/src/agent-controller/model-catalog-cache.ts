import type { GatewayManager, GatewayModel, MastraModelGatewayInterface, ProviderConfig } from '../llm/model/gateways';

/**
 * How long a built catalog is served before configured gateways and
 * per-provider auth are checked again. Configured gateways can read state the
 * app changes at runtime (stored credentials, custom providers), so this stays
 * short.
 */
export const MODEL_CATALOG_TTL_MS = 10_000;

/** How often remote catalogs (models.dev, Netlify, ...) are refreshed in the background. */
export const REMOTE_CATALOG_REFRESH_MS = 5 * 60_000;

/** After a remote catalog fails, how long its last known providers are served before the next try. */
export const REMOTE_CATALOG_RETRY_MS = 60_000;

type Providers = Record<string, ProviderConfig>;

interface RemoteSnapshot {
  /** Last successful result; `undefined` until the gateway has answered once. */
  providers: Providers | undefined;
  nextFetchAt: number;
}

/**
 * Model catalog cache with two refresh speeds.
 *
 * Remote gateways download public catalogs (models.dev's is ~6 MB), so they
 * are refreshed in the background while their last good result keeps being
 * served, including when a refresh fails. Only the very first build waits for
 * them.
 *
 * Everything else (configured gateways and per-provider auth) is rebuilt at
 * most every {@link MODEL_CATALOG_TTL_MS}, or on the next call after
 * {@link invalidate}, on top of the latest remote snapshot.
 *
 * Concurrent callers share one build and one remote download.
 */
export class ModelCatalogCache {
  readonly #manager: GatewayManager;
  readonly #isRemote: (gateway: MastraModelGatewayInterface) => boolean;
  readonly #remote = new Map<MastraModelGatewayInterface, RemoteSnapshot>();
  /** Last successful result of each configured gateway, served when it fails. */
  readonly #local = new Map<MastraModelGatewayInterface, Providers>();
  #remoteVersion = 0;
  #remoteRefresh: Promise<void> | undefined;
  #models: GatewayModel[] | undefined;
  #modelsBuiltAt = 0;
  #modelsRemoteVersion = -1;
  #build: Promise<GatewayModel[]> | undefined;
  /** Bumped by {@link invalidate} so builds started before it are not kept. */
  #generation = 0;

  constructor(manager: GatewayManager, isRemote: (gateway: MastraModelGatewayInterface) => boolean) {
    this.#manager = manager;
    this.#isRemote = isRemote;
  }

  async list(): Promise<GatewayModel[]> {
    if (this.#isRemoteRefreshDue()) {
      this.#refreshRemote().catch(() => {});
    }
    const fresh =
      this.#models !== undefined &&
      this.#modelsRemoteVersion === this.#remoteVersion &&
      Date.now() - this.#modelsBuiltAt < MODEL_CATALOG_TTL_MS;
    if (fresh) return this.#models!;
    return this.#rebuild();
  }

  /**
   * Rebuild configured gateways and auth on the next call (for example after a
   * credential change). Remote catalogs don't depend on credentials and keep
   * their own refresh schedule.
   */
  invalidate(): void {
    this.#generation += 1;
    this.#models = undefined;
    this.#build = undefined;
  }

  #rebuild(): Promise<GatewayModel[]> {
    if (this.#build) return this.#build;
    const build = this.#buildCatalog(this.#generation).finally(() => {
      if (this.#build === build) this.#build = undefined;
    });
    this.#build = build;
    return build;
  }

  async #buildCatalog(generation: number): Promise<GatewayModel[]> {
    const gateways = this.#manager.gateways;
    const local = gateways.filter(gateway => !this.#isRemote(gateway));
    const remoteNeverFetched = gateways.some(gateway => this.#isRemote(gateway) && !this.#remote.has(gateway));

    const [localResults] = await Promise.all([
      Promise.all(local.map(gateway => this.#manager.fetchGatewayProviders(gateway))),
      remoteNeverFetched ? this.#refreshRemote() : undefined,
    ]);

    const localProviders = new Map(
      local.map((gateway, index) => [gateway, localResults[index] ?? this.#local.get(gateway) ?? {}] as const),
    );
    const remoteVersion = this.#remoteVersion;
    const registry = this.#manager.mergeProviders(
      gateways.map(gateway => ({
        gateway,
        providers: this.#isRemote(gateway)
          ? (this.#remote.get(gateway)?.providers ?? {})
          : (localProviders.get(gateway) ?? {}),
      })),
    );
    const models = await this.#manager.listModelsForProviders(registry);

    if (generation === this.#generation) {
      local.forEach((gateway, index) => {
        const providers = localResults[index];
        if (providers) this.#local.set(gateway, providers);
      });
      this.#models = models;
      this.#modelsBuiltAt = Date.now();
      this.#modelsRemoteVersion = remoteVersion;
    }
    return models;
  }

  #isRemoteRefreshDue(): boolean {
    const now = Date.now();
    return this.#manager.gateways.some(
      gateway => this.#isRemote(gateway) && (this.#remote.get(gateway)?.nextFetchAt ?? 0) <= now,
    );
  }

  #refreshRemote(): Promise<void> {
    this.#remoteRefresh ??= this.#fetchRemote().finally(() => {
      this.#remoteRefresh = undefined;
    });
    return this.#remoteRefresh;
  }

  async #fetchRemote(): Promise<void> {
    const now = Date.now();
    const due = this.#manager.gateways.filter(
      gateway => this.#isRemote(gateway) && (this.#remote.get(gateway)?.nextFetchAt ?? 0) <= now,
    );
    if (due.length === 0) return;

    const results = await Promise.all(due.map(gateway => this.#manager.fetchGatewayProviders(gateway)));
    const fetchedAt = Date.now();
    due.forEach((gateway, index) => {
      const providers = results[index];
      const previous = this.#remote.get(gateway)?.providers;
      if (providers) {
        this.#remote.set(gateway, { providers, nextFetchAt: fetchedAt + REMOTE_CATALOG_REFRESH_MS });
      } else if (previous) {
        // Keep serving the last good catalog rather than dropping its providers.
        this.#remote.set(gateway, { providers: previous, nextFetchAt: fetchedAt + REMOTE_CATALOG_RETRY_MS });
      } else {
        // Nothing to fall back on yet: retry at the normal catalog cadence.
        this.#remote.set(gateway, { providers: undefined, nextFetchAt: fetchedAt + MODEL_CATALOG_TTL_MS });
      }
    });
    this.#remoteVersion += 1;
  }
}
