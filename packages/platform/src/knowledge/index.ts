import { Knowledge } from '@mastra/core/knowledge';
import type { KnowledgeConfig, KnowledgeScopeDeclarations } from '@mastra/core/knowledge';
import type { IMastraLogger } from '@mastra/core/logger';
import {
  MastraCompositeStore,
  KnowledgeStorage,
  KnowledgeConflictError,
  KnowledgeMoveTooLargeError,
  KnowledgeNotFoundError,
  KnowledgePageDepthError,
  KnowledgePageHasChildrenError,
  KnowledgePageKeyConflictError,
} from '@mastra/core/storage';
import type { KnowledgePageStore } from '@mastra/core/storage';
import type { PlatformAccessToken } from '@mastra/platform-workspace';
import { handleImporterRun } from './importer-run';

/**
 * The part of a core importer class (`class X extends KnowledgeImporter({ ... })`) that
 * PlatformKnowledge uses. It's declared here instead of using core's `KnowledgeImporterClass` because
 * older cores in this package's peer range don't have that type. Replace it with core's type in the
 * next breaking release.
 *
 * @experimental
 */
export interface PlatformKnowledgeImporterClass {
  new (...args: any[]): unknown;
  readonly id: string;
  toManifest(): { readonly id: string; readonly label: string };
}

export interface PlatformKnowledgeOptions extends Omit<
  KnowledgeConfig,
  'storage' | 'vector' | 'embedder' | 'embedderOptions' | 'scopes' | 'importers'
> {
  /** A token, or a function called before every request so long-lived clients never hold an expired one. */
  accessToken?: PlatformAccessToken;
  projectId?: string;
  instanceId?: string;
  /**
   * Knowledge API URL. Falls back to `MASTRA_KNOWLEDGE_API_URL`, then `https://knowledge-api.mastra.ai`.
   */
  apiUrl?: string;
  /**
   * Importer classes this app offers Platform, e.g. `[HelpSpotImporter]`, so Platform can read their
   * manifests. Pass the classes, not instances: Platform supplies each binding's target, settings and
   * credentials. Needs a `@mastra/core` with Knowledge importers.
   *
   * @experimental
   */
  importers?: readonly PlatformKnowledgeImporterClass[];
  /**
   * Env var names an importer may never read, even if Platform names one for a credential. The app's
   * own `MASTRA_KNOWLEDGE_ACCESS_TOKEN`, `MASTRA_PLATFORM_ACCESS_TOKEN` and `MASTRA_PLATFORM_SECRET_KEY`
   * are always denied.
   *
   * @experimental
   */
  deniedCredentialEnv?: readonly string[];
}

// These are the schema-v4 page-store methods, not arbitrary object properties or storage lifecycle methods.
// `renameScopeDeclaration` is left to the base class, which rejects it: its `check` callback can't be
// serialized, so the hosted store couldn't validate affected scopes before re-keying them.
const operations = [
  'materializeScope',
  'getScopesByAddress',
  'listScopeDeclarations',
  'listChildScopes',
  'countChildScopes',
  'getPage',
  'getPages',
  'getPageByPath',
  'findPagesByName',
  'listChildPages',
  'countChildPages',
  'listPages',
  'createPage',
  'updatePage',
  'movePage',
  'mergePages',
  'deletePage',
  'getNote',
  'countNotes',
  'listNotes',
  'listNotesMentioning',
  'addNote',
  'restampNote',
  'removeNote',
  'restoreNote',
  'searchPages',
  'listPageActivity',
  'addPinAudience',
  'removePinAudience',
  'listPins',
  'countPageLinks',
  'listPageLinks',
  'replacePageBodyLinks',
  'listPageBodyLinkSources',
] as const satisfies readonly (keyof KnowledgePageStore)[];

// Fails to compile when a page-store method is neither forwarded nor deliberately left to the base class.
type UnforwardedOperation = Exclude<keyof KnowledgePageStore, (typeof operations)[number]>;
const operationsAreExhaustive: [UnforwardedOperation] extends ['renameScopeDeclaration']
  ? ['renameScopeDeclaration'] extends [UnforwardedOperation]
    ? true
    : never
  : never = true;
void operationsAreExhaustive;

function encode(value: unknown): string {
  return JSON.stringify(value, function (key, item: unknown) {
    const original: unknown = key ? (this as Record<string, unknown>)[key] : item;
    return original instanceof Date ? { __knowledgeDate: original.toISOString() } : item;
  });
}

function decode<T>(text: string): T {
  return JSON.parse(text, (_key, value: unknown) => {
    if (value && typeof value === 'object' && '__knowledgeDate' in value) {
      return new Date((value as { __knowledgeDate: string }).__knowledgeDate);
    }
    return value;
  }) as T;
}

class RemoteKnowledgeStorage extends KnowledgeStorage {
  constructor(
    private readonly endpoint: string,
    private readonly token: PlatformAccessToken,
  ) {
    super({ storageIsolationKey: endpoint });
    return new Proxy(this, {
      get(target, key) {
        if (typeof key === 'string' && operations.includes(key as (typeof operations)[number])) {
          return (input?: unknown) => target.request(key, input);
        }
        const value: unknown = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }

  private async request(operation: string, input?: unknown): Promise<unknown> {
    const token = typeof this.token === 'function' ? await this.token() : this.token;
    const response = await fetch(`${this.endpoint}/operations/${operation}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        // This client merges the instance's scope declarations (`getScopeDeclarations`) into its own, so
        // the service leaves its read views as they are rather than widening them for older clients.
        'x-mastra-knowledge-store-declarations': 'merged',
      },
      body: encode({ input }),
      signal: AbortSignal.timeout(30_000),
    });
    const text = await response.text();
    if (!response.ok) {
      let body: {
        name?: string;
        detail?: string;
        title?: string;
        error?: { name?: string; message?: string };
        key?: unknown;
        parentId?: unknown;
        pageId?: unknown;
        pages?: unknown;
      } = {};
      try {
        const parsed: unknown = JSON.parse(text);
        if (parsed && typeof parsed === 'object') body = parsed;
      } catch {
        // Gateways can return non-JSON error pages.
      }
      const message =
        body.detail ||
        body.error?.message ||
        body.title ||
        (text
          ? `Knowledge request failed (${response.status}): ${text}`
          : `Knowledge request failed (${response.status})`);
      const name = body.name ?? body.error?.name;
      if (name === 'KnowledgeNotFoundError') {
        const error = new KnowledgeNotFoundError('record', operation);
        error.message = message;
        throw error;
      }
      if (name === 'KnowledgeConflictError') {
        const error = new KnowledgeConflictError(operation);
        error.message = message;
        throw error;
      }
      if (name === 'KnowledgePageKeyConflictError') {
        const key = typeof body.key === 'string' ? body.key : '';
        const parentId = typeof body.parentId === 'string' ? body.parentId : '';
        const error = new KnowledgePageKeyConflictError(key, parentId);
        error.message = message;
        throw error;
      }
      if (name === 'KnowledgePageHasChildrenError') {
        const error = new KnowledgePageHasChildrenError('');
        error.message = message;
        throw error;
      }
      if (name === 'KnowledgePageDepthError') {
        const error = new KnowledgePageDepthError('');
        error.message = message;
        throw Object.assign(error, { status: response.status });
      }
      if (name === 'KnowledgeMoveTooLargeError') {
        const pageId = typeof body.pageId === 'string' ? body.pageId : '';
        const pages = typeof body.pages === 'number' ? body.pages : 0;
        const error = new KnowledgeMoveTooLargeError(pageId, pages);
        error.message = message;
        throw Object.assign(error, { status: response.status });
      }
      throw Object.assign(new Error(message), { status: response.status });
    }
    return decode<{ result?: unknown }>(text).result;
  }

  /**
   * The scope declarations the instance supplies, such as the ones its importers write to, with their
   * access rules. A service that doesn't have the operation yet answers 404 "Knowledge operation not
   * found" and supplies none. Any other failure, including another 404 (a missing instance, a wrong
   * URL), and anything but a declaration record is a broken response, not "none".
   */
  override async getScopeDeclarations(): Promise<KnowledgeScopeDeclarations> {
    let result: unknown;
    try {
      result = await this.request('getScopeDeclarations');
    } catch (error) {
      const status = (error as { status?: unknown }).status;
      if (status === 404 && (error as Error).message === 'Knowledge operation not found') return {};
      throw error;
    }
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new Error('Knowledge service answered getScopeDeclarations without a declaration record');
    }
    return result as KnowledgeScopeDeclarations;
  }

  override getCapabilities() {
    return {
      contractVersion: 4,
      schemaVersion: 4,
      supportsSchemaInspection: false,
      supportsExplicitReset: false,
      // The service's stores keep a pin's kind and depth, so listing pins round-trip.
      supportsPinKinds: true,
    } as const;
  }

  override async dangerouslyClearAll(): Promise<void> {
    throw new Error('Hosted Knowledge cannot be cleared from the client');
  }
}

const DEFAULT_API_URL = 'https://knowledge-api.mastra.ai';

export class PlatformKnowledge extends Knowledge {
  readonly #importerClasses: readonly PlatformKnowledgeImporterClass[];
  readonly #deniedCredentialEnv: readonly string[];
  #importerWarnings: string[] = [];
  readonly #apiUrl: string;
  readonly #instanceId: string;

  constructor(options: PlatformKnowledgeOptions = {}) {
    // `MASTRA_KNOWLEDGE_ACCESS_TOKEN` is a Knowledge-only credential, narrower than the general
    // Platform token, so it's preferred when set.
    const token =
      options.accessToken ??
      (process.env.MASTRA_KNOWLEDGE_ACCESS_TOKEN?.trim() || undefined) ??
      process.env.MASTRA_PLATFORM_ACCESS_TOKEN ??
      process.env.MASTRA_PLATFORM_SECRET_KEY;
    const instanceId = options.instanceId ?? process.env.MASTRA_KNOWLEDGE_INSTANCE_ID;
    const apiUrl = options.apiUrl ?? (process.env.MASTRA_KNOWLEDGE_API_URL?.trim() || undefined) ?? DEFAULT_API_URL;
    if (!token) {
      throw new Error(
        'PlatformKnowledge requires a Knowledge token or Platform access token, and a Knowledge instance ID',
      );
    }
    if (!instanceId) {
      throw new Error(
        'PlatformKnowledge requires a Knowledge instance ID: set MASTRA_KNOWLEDGE_INSTANCE_ID or pass instanceId',
      );
    }
    const {
      accessToken: _accessToken,
      projectId: _projectId,
      instanceId: _instanceId,
      apiUrl: _apiUrl,
      importers = [],
      deniedCredentialEnv = [],
      ...config
    } = options;
    const endpoint = `${apiUrl.replace(/\/$/, '')}/v1/knowledge/${encodeURIComponent(instanceId)}`;
    const storage = new MastraCompositeStore({
      id: `platform-knowledge-${instanceId}`,
      domains: { knowledge: new RemoteKnowledgeStorage(endpoint, token) },
    });
    super({
      ...config,
      // Hosts register Knowledge under its id, so it must be the same on every boot.
      id: config.id ?? `platform-knowledge-${instanceId}`,
      tools: config.tools ?? { read: true },
      // Platform owns every scope declaration and access grant: the instance serves them all through
      // `getScopeDeclarations`, so there is one place to change who reads what. Declaring scopes here
      // too would conflict with the instance's (a key both declare silently takes the code's rules,
      // and overlapping patterns break every call), so PlatformKnowledge takes no `scopes` option.
      scopes: {},
      storage,
    });
    this.#apiUrl = apiUrl;
    this.#instanceId = instanceId;
    // Older cores in the peer range have no importers on Knowledge: Platform could list the classes but
    // never run them, so refuse rather than start half-working.
    if (importers.length > 0 && !('importers' in Knowledge.prototype)) {
      throw new TypeError(
        'PlatformKnowledge `importers` needs a @mastra/core with Knowledge importers. Upgrade @mastra/core.',
      );
    }
    const classes: PlatformKnowledgeImporterClass[] = [];
    const seen = new Set<PlatformKnowledgeImporterClass>();
    for (const importer of importers) {
      if (typeof importer !== 'function' || typeof importer.toManifest !== 'function') {
        throw new TypeError(
          'PlatformKnowledge `importers` takes importer classes, e.g. `[HelpSpotImporter]`, not instances: Platform supplies each binding.',
        );
      }
      // Every class is judged once, so a dropped class listed again doesn't warn again.
      if (seen.has(importer)) continue;
      seen.add(importer);
      if (classes.some(known => known.id === importer.id)) {
        this.#importerWarnings.push(
          `PlatformKnowledge has two importer classes with the id "${importer.id}"; keeping the first one listed. Give each class its own id.`,
        );
        continue;
      }
      classes.push(importer);
    }
    this.#importerClasses = Object.freeze(classes);
    this.#deniedCredentialEnv = Object.freeze([...deniedCredentialEnv]);
  }

  // The logger a Knowledge starts with drops warnings, so they wait for the first one the app's Mastra
  // hands over. Mastra hands one over more than once while it starts; warn only the first time.
  override __setLogger(logger: IMastraLogger): void {
    super.__setLogger(logger);
    for (const message of this.#importerWarnings) this.logger.warn(message);
    this.#importerWarnings = [];
  }

  /**
   * The importer classes from the `importers` option, each id once, in the order given.
   *
   * @experimental
   */
  get importerClasses(): readonly PlatformKnowledgeImporterClass[] {
    return this.#importerClasses;
  }

  /**
   * Answers Mastra Platform's trigger for one importer run. Mount it at
   * `POST /_mastra/knowledge-importers/run` with `registerApiRoute`. The request's run token is the only input: the run is claimed
   * from this instance's Knowledge API, its credentials are read from the app's environment, and it
   * runs one of `importerClasses` in the background. Answers 202 once started, 401 without a run
   * token, 404 for another instance's run.
   *
   * @experimental
   */
  handleImporterRun(request: Request): Promise<Response> {
    return handleImporterRun(request, {
      apiUrl: this.#apiUrl,
      instanceId: this.#instanceId,
      importers: this.#importerClasses,
      deniedCredentialEnv: this.#deniedCredentialEnv,
      onDeniedCredential: name =>
        this.logger.warn(`Knowledge importer run asked for ${name}, which importers may not read`),
      onError: error => this.logger.error('Knowledge importer run failed', { error }),
    });
  }
}

export { encode as encodeKnowledgeTransport, decode as decodeKnowledgeTransport };
export { operations as knowledgeOperations };
