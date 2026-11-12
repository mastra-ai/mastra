import type { GatewayManager, GatewayModel, MastraModelGatewayInterface, ProviderConfig } from '../llm/model/gateways';

/**
 * How long a built catalog is served before configured gateways and
 * per-provider auth are checked again. Configured gateways can read state the
 * app changes at runtime (stored credentials, custom providers), so this stays
 * short.
 */
const MODEL_CATALOG_TTL_MS = 10_000;

/** How long a downloaded remote catalog (models.dev, Netlify, ...) is served before a call refreshes it in the background. */
const REMOTE_CATALOG_REFRESH_MS = 5 * 60_000;

/** After a remote catalog fails, how long its last known providers are served before the next try. */
const REMOTE_CATALOG_RETRY_MS = 60_000;

type Providers = Record<string, ProviderConfig>;

interface RemoteSnapshot {
  /** Last successful result; `undefined` until the gateway has answered once. */
  providers: Providers | undefined;
  nextFetchAt: number;
}

interface BuiltCatalog {
  models: GatewayModel[];
  builtAt: number;
  remoteVersion: number;
}

/**
 * Model catalog cache with two refresh speeds.
 *
 * Remote gateways download public catalogs (models.dev's is ~6 MB). Once a
 * downloaded catalog is older than {@link REMOTE_CATALOG_REFRESH_MS}, the next
 * call refreshes it in the background and keeps serving the last good result,
 * including when the refresh fails. A call waits for a remote gateway only
 * while it has nothing to serve: before its first successful download.
 *
 * Everything else (configured gateways and per-provider auth) is rebuilt at
 * most every {@link MODEL_CATALOG_TTL_MS}, or on the next call after
 * {@link invalidate}, on top of the latest remote snapshot.
 *
 * Concurrent callers share one build. Each remote gateway downloads on its
 * own, so a slow or stalled one never holds back the others.
 */
export class ModelCatalogCache {
  readonly #manager: GatewayManager;
  readonly #isRemote: (gateway: MastraModelGatewayInterface) => boolean;
  readonly #remote = new Map<MastraModelGatewayInterface, RemoteSnapshot>();
  #remoteVersion = 0;
  /** In-flight download per remote gateway, so a stalled gateway never holds back the others. */
  readonly #remoteRefreshes = new Map<MastraModelGatewayInterface, Promise<void>>();
  #built: BuiltCatalog | undefined;
  #build: Promise<GatewayModel[]> | undefined;
  /** Bumped by {@link invalidate} so builds started before it are not kept. */
  #generation = 0;

  constructor(manager: GatewayManager, isRemote: (gateway: MastraModelGatewayInterface) => boolean) {
    this.#manager = manager;
    this.#isRemote = isRemote;
  }

  async list(): Promise<GatewayModel[]> {
    if (this.#mustWaitForRemote()) return this.#rebuild();
    if (this.#dueRemoteGateways().length > 0) {
      this.#refreshRemote().catch(() => {});
    }
    const built = this.#built;
    if (built && built.remoteVersion === this.#remoteVersion && Date.now() - built.builtAt < MODEL_CATALOG_TTL_MS) {
      return built.models;
    }
    return this.#rebuild();
  }

  /**
   * Rebuild configured gateways and auth on the next call (for example after a
   * credential change), and download the remote catalogs again in the
   * background.
   */
  invalidate(): void {
    this.#generation += 1;
    this.#built = undefined;
    this.#build = undefined;
    for (const snapshot of this.#remote.values()) snapshot.nextFetchAt = 0;
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

    const [localProviders] = await Promise.all([
      this.#fetchLocal(local),
      this.#mustWaitForRemote() ? this.#refreshRemote() : undefined,
    ]);

    const remoteVersion = this.#remoteVersion;
    const registry = this.#manager.mergeProviders(
      gateways.map(gateway => ({
        gateway,
        providers: (this.#isRemote(gateway) ? this.#remote.get(gateway)?.providers : localProviders.get(gateway)) ?? {},
      })),
    );
    const models = await this.#manager.listModelsForProviders(registry);

    if (generation === this.#generation) this.#built = { models, builtAt: Date.now(), remoteVersion };
    return models;
  }

  async #fetchLocal(
    gateways: MastraModelGatewayInterface[],
  ): Promise<Map<MastraModelGatewayInterface, Providers | undefined>> {
    const providers = new Map<MastraModelGatewayInterface, Providers | undefined>();
    // One at a time: a gateway can write credentials the next one reloads (Copilot token refresh, MastraCodeGateway).
    for (const gateway of gateways) providers.set(gateway, await this.#manager.fetchGatewayProviders(gateway));
    return providers;
  }

  #dueRemoteGateways(): MastraModelGatewayInterface[] {
    const now = Date.now();
    return this.#manager.gateways.filter(
      gateway => this.#isRemote(gateway) && (this.#remote.get(gateway)?.nextFetchAt ?? 0) <= now,
    );
  }

  #mustWaitForRemote(): boolean {
    return this.#dueRemoteGateways().some(gateway => !this.#remote.get(gateway)?.providers);
  }

  /**
   * Starts a download for each due remote gateway that is not already
   * downloading. Resolves once the gateways with nothing to serve yet have
   * answered; the others finish in the background.
   */
  #refreshRemote(): Promise<void> {
    const waits: Promise<void>[] = [];
    for (const gateway of this.#dueRemoteGateways()) {
      let refresh = this.#remoteRefreshes.get(gateway);
      if (!refresh) {
        refresh = this.#fetchRemote(gateway).finally(() => this.#remoteRefreshes.delete(gateway));
        this.#remoteRefreshes.set(gateway, refresh);
      }
      if (!this.#remote.get(gateway)?.providers) waits.push(refresh);
    }
    return Promise.all(waits).then(() => {});
  }

  /** Downloads one remote gateway and publishes its result as soon as it lands. */
  async #fetchRemote(gateway: MastraModelGatewayInterface): Promise<void> {
    const providers = await this.#manager.fetchGatewayProviders(gateway);
    const fetchedAt = Date.now();
    const previous = this.#remote.get(gateway)?.providers;
    if (providers) {
      this.#remote.set(gateway, { providers, nextFetchAt: fetchedAt + REMOTE_CATALOG_REFRESH_MS });
    } else if (previous) {
      this.#remote.set(gateway, { providers: previous, nextFetchAt: fetchedAt + REMOTE_CATALOG_RETRY_MS });
    } else {
      // Nothing to fall back on yet: retry at the normal catalog cadence.
      this.#remote.set(gateway, { providers: undefined, nextFetchAt: fetchedAt + MODEL_CATALOG_TTL_MS });
    }
    this.#remoteVersion += 1;
  }
}
