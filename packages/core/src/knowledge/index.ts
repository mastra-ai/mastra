import { randomUUID } from 'node:crypto';
import { MastraBase } from '../base';
import type { Mastra } from '../mastra';
import type { MastraCompositeStore } from '../storage';
import type { KnowledgeReadScope, KnowledgeStorage } from '../storage/domains/knowledge';
import type { KnowledgeNote, KnowledgePage } from '../storage/domains/knowledge/pages';
import { augmentWithInit, getStorageSource } from '../storage/storageWithInit';
import type { ToolAction } from '../tools';
import { knowledgeAccessGrants } from './access';
import { emitKnowledgeChanges } from './changes';
import type { KnowledgeChangeEvent, KnowledgeChangeListener } from './changes';
import type { KnowledgeConfig } from './config';
import { KnowledgeDeclarationError, strongerKnowledgeRole } from './declarations';
import type {
  KnowledgeRole,
  KnowledgeScopeDeclaration as ScopeDeclaration,
  KnowledgeScopeDeclarationInfo,
} from './declarations';
import {
  addKnowledgeNote,
  moveKnowledgePage,
  removeKnowledgeNote,
  removeKnowledgePage,
  updateKnowledgeNote,
  upsertKnowledgePage,
} from './host-writes';
import type {
  KnowledgeAddNoteInput,
  KnowledgeHostWriter,
  KnowledgeMovePageInput,
  KnowledgeRemovePageInput,
  KnowledgeUpdateNoteInput,
  KnowledgeUpsertPageInput,
  KnowledgeUpsertPageResult,
} from './host-writes';
import { KnowledgeImporterDefinitionError, knowledgeImporterRegistry, runKnowledgeImport } from './importers';
import type {
  KnowledgeImporterClass,
  KnowledgeImporterHost,
  RunKnowledgeImportOptions,
  RunKnowledgeImportResult,
} from './importers';
import { createLocalKnowledgeImporterHost } from './importers/local-host';
import type { KnowledgeImporterServiceHost, LocalKnowledgeImporterHostOptions } from './importers/local-host';
export type { KnowledgeImporterServiceHost, KnowledgeImporterServiceStartOptions } from './importers/local-host';

/** Reads a Knowledge's host writer for {@link createKnowledgeImporterHost}; set in the class's static block. */
let hostWriterOf: (knowledge: Knowledge) => KnowledgeHostWriter;
import { buildKnowledgeInstructions } from './instructions';
import type { KnowledgeInstructionsOption } from './instructions';
import { reindexKnowledgeLinks } from './links';
import { buildKnowledgePageTools } from './page-tools';
import { DEFAULT_MAX_PINS, DEFAULT_PINNED_MAX_TOKENS, knowledgeDeliveredPins } from './pinned';
import type { PinBudget, PinEntry } from './pinned';
import { PINNED_READ_MEMO_KEY } from './pinned-state-processor';
import { reembedKnowledge } from './reembed';
import type { KnowledgeReembedOptions, KnowledgeReembedResult } from './reembed';
import { KnowledgeRun, knowledgeRunPrincipals } from './run';
import type { KnowledgeRunContext } from './run';
import { KnowledgeScopeRuntime } from './scope-runtime';
import type { KnowledgeAccessExplanation } from './scope-runtime';

function resolvePins(pins: KnowledgeConfig['pinnedContext']): false | PinBudget {
  if (!pins) return false;
  const options = pins === true ? {} : pins;
  return {
    maxPins: options.maxPins ?? DEFAULT_MAX_PINS,
    maxTokens: options.maxTokens ?? DEFAULT_PINNED_MAX_TOKENS,
  };
}

/** Below this share of the pin budget each, config pins are too cut down to be useful. */
const MIN_TOKENS_PER_CONFIG_PIN = 50;

/** Overrides which tool groups `createTools` and `getInstructions` cover. */
type KnowledgeToolSelection = { read?: boolean; write?: boolean; pinnedContext?: boolean };

/** Options for {@link Knowledge.createTools}. */
export type KnowledgeCreateToolsOptions = KnowledgeToolSelection & {
  /**
   * **Host-only.** Fixed principals for every call, for hosts that run the tools outside an agent run
   * (an MCP server acting for an external agent). Each must match a declared scope type (checked at each call, once the store's declarations have loaded). When set, the
   * call's own run scopes and Memory ids are ignored, and access follows the scope rules for these
   * principals. Never take them from the request.
   */
  principals?: readonly string[];
  /** Author recorded on writes made through these tools. Defaults to `agent:<id>` of the run, or `agent`. */
  author?: string;
};

/** @experimental Knowledge APIs are experimental and may change without notice. */
export class Knowledge extends MastraBase {
  readonly id: string;
  readonly hasOwnStorage: boolean;

  readonly description?: string;

  #storage?: MastraCompositeStore;
  #storageSource?: MastraCompositeStore;
  #storagePromise?: Promise<KnowledgeStorage>;
  #runtime: KnowledgeScopeRuntime;
  #tools: { read: boolean; write: boolean; maxTokens?: number };
  #pins: false | PinBudget;
  #instructions?: KnowledgeInstructionsOption;
  #importers?: KnowledgeConfig['importers'];
  #semantic?: KnowledgeSemanticIndex;
  #listeners = new Set<KnowledgeChangeListener>();

  /** Config pins are never dropped, so a scope with more of them than the budget holds is a setup mistake. */
  #warnOnPinOvercommit(budget: PinBudget) {
    const { declarations, concrete } = this.#runtime.compiled;
    const entries: Array<[string, ScopeDeclaration['pinnedContext']]> = [
      ...[...declarations.values()].map(
        compiled => [compiled.key, compiled.declaration.pinnedContext] as [string, ScopeDeclaration['pinnedContext']],
      ),
      ...[...concrete].map(
        ([address, entry]) => [address, entry.declaration.pinnedContext] as [string, ScopeDeclaration['pinnedContext']],
      ),
    ];
    for (const [key, pins] of entries) {
      const count = pins?.length ?? 0;
      if (count === 0) continue;
      if (count > budget.maxPins || budget.maxTokens / count < MIN_TOKENS_PER_CONFIG_PIN) {
        this.logger.warn(
          `Knowledge scope "${key}" has ${count} pinnedContext pages for a budget of ${budget.maxPins} pins / ${budget.maxTokens} tokens; pinnedContext pages are never dropped, so each will be cut to about ${Math.floor(budget.maxTokens / count)} tokens and stored pins won't fit. Pin fewer pages or raise pinnedContext.maxTokens.`,
        );
      }
    }
  }

  constructor(config: KnowledgeConfig) {
    super({ component: 'STORAGE', name: config?.name ?? config?.id ?? 'Knowledge' });
    if (!config?.scopes || typeof config.scopes !== 'object') {
      throw new KnowledgeDeclarationError(
        'Knowledge needs `scopes`: declare the scopes its runs hold, e.g. `scopes: { ...knowledgeMemoryScopes() }`, or `{}` for none.',
      );
    }
    this.id = config.id ?? randomUUID();
    this.description = config.description;
    const tools = config.tools;
    this.#tools =
      typeof tools === 'object'
        ? {
            read: Boolean(tools.read),
            write: Boolean(tools.write),
            maxTokens: typeof tools.read === 'object' ? tools.read.maxTokens : undefined,
          }
        : { read: Boolean(tools), write: Boolean(tools) };
    const maxTokens = this.#tools.maxTokens;
    if (maxTokens !== undefined && (!Number.isInteger(maxTokens) || maxTokens < 100)) {
      throw new Error(`Knowledge \`tools.read.maxTokens\` must be a whole number of at least 100; got ${maxTokens}.`);
    }
    this.#pins = resolvePins(config.pinnedContext);
    this.#instructions = config.instructions;
    if (config.importers) {
      knowledgeImporterRegistry(config.importers.map(importer => importer.constructor as KnowledgeImporterClass));
      const ids = new Set<string>();
      for (const importer of config.importers) {
        if (ids.has(importer.binding.id)) {
          throw new KnowledgeImporterDefinitionError(`Two importers have the binding id "${importer.binding.id}".`);
        }
        ids.add(importer.binding.id);
      }
    }
    this.#importers = config.importers;
    if (Boolean(config.vector) !== Boolean(config.embedder)) {
      throw new Error('Knowledge semantic search needs both `vector` and `embedder`; pass both or neither.');
    }
    if (config.vector && config.embedder) {
      this.#semantic = new KnowledgeSemanticIndex(config.vector, config.embedder, config.embedderOptions);
    }
    this.#runtime = new KnowledgeScopeRuntime(
      config.scopes,
      () => this.getStorage(),
      message => this.logger.warn(message),
    );
    if (this.#pins) this.#warnOnPinOvercommit(this.#pins);
    this.hasOwnStorage = config.storage !== undefined;
    if (config.storage) {
      this.#storageSource = getStorageSource(config.storage);
      this.#storage = augmentWithInit(config.storage);
    }
  }

  /**
   * What a holder of `principals` reads: the principals themselves plus every scope their declared
   * rules reach in one hop. Undeclared principals throw; an empty list reads nothing. Never `'all'`.
   * Pass the result as `read` to the store's read methods.
   */
  async readScopeFor(principals: readonly string[]): Promise<KnowledgeReadScope> {
    await this.#runtime.resolve();
    return this.#runtime.readScopeFor(principals);
  }

  /**
   * Why a run holding `runScopes` can or can't reach a scope or page: its role there and the rules
   * that give it. `runScopes` are canonical run scopes, as passed to an agent run; undeclared ones throw
   * like they do at run start. `target` is a scope address, or a page id or `<scope>#<key>[/<key>…]`.
   *
   * **Host-only.** It tells a missing page from a hidden one, which runs must never learn. Never
   * expose it through an agent tool, or through a server route without admin-level auth.
   *
   * @experimental
   */
  async explainAccess(
    runScopes: readonly string[],
    target: { scope: string } | { page: string },
  ): Promise<KnowledgeAccessExplanation> {
    await this.#runtime.resolve();
    return this.#runtime.explainAccess(runScopes, target);
  }

  /**
   * Reads the store's scope declarations into the ones {@link scopeGrants}, {@link scopeDeclaration}
   * and {@link scopeLabel} use, reusing a read from the last 30 seconds. Call it before those when
   * nothing else async ran first, e.g. at the start of a browsing request. Checks nothing and grants
   * nothing.
   *
   * @experimental
   */
  async resolveScopeDeclarations(): Promise<void> {
    await this.#runtime.resolve();
  }

  /**
   * Who the declared rules give a role on one scope: each principal scope address (bound for this
   * scope's params) with its strongest role, `self` rules left out. `parentAddress` is the
   * address of the scope page's tree parent, needed for rules that bind through `belongsTo`. Reads the
   * declarations as last resolved, not storage (see {@link Knowledge.resolveScopeDeclarations}). For
   * browsing UIs that draw access between scopes.
   *
   * @experimental
   */
  scopeGrants(scope: { address: string; parentAddress?: string | null }): KnowledgeScopeGrant[] {
    const strongest = new Map<string, KnowledgeRole>();
    for (const grant of knowledgeAccessGrants(this.#runtime.compiled, 'any', scope)) {
      if (grant.via === 'self') continue;
      strongest.set(grant.principal, strongerKnowledgeRole(strongest.get(grant.principal) ?? null, grant.role));
    }
    return [...strongest].map(([principal, role]) => ({ principal, role }));
  }

  /**
   * After renaming a scope declaration key in `scopes`, moves the scopes stored under the old key
   * (and its template children, `from/<name>`) to the new one, in one atomic step. Until then this
   * instance refuses to run: stored scopes under an undeclared key would otherwise silently lose
   * prefix and `belongsTo` reach. Refuses when `from` is still declared, `to` isn't, or any stored
   * address doesn't match the `to` pattern; nothing changes then. Returns how many scopes moved.
   *
   * In a rolling deploy, instances with the new config fail until the rename runs, and instances
   * still on the old config lose reach to those scopes after it; deploy, then rename right away.
   *
   * @experimental
   */
  async renameScopeDeclaration(from: string, to: string): Promise<number> {
    await this.#runtime.resolve();
    return this.#runtime.renameScopeDeclaration(from, to);
  }

  #groups(override?: KnowledgeToolSelection): { read: boolean; write: boolean; pins: boolean } {
    const pinnedContext = override?.pinnedContext;
    return {
      read: override?.read ?? this.#tools.read,
      write: override?.write ?? this.#tools.write,
      pins: pinnedContext ?? this.#pins !== false,
    };
  }

  /** Tools for explicit wiring; defaults to the groups configured on this Knowledge. */
  createTools(options?: KnowledgeCreateToolsOptions): Record<string, ToolAction<any, any, any>> {
    const principals = options?.principals ? this.#hostPrincipals(options.principals) : undefined;
    return buildKnowledgePageTools(
      {
        runtime: this.#runtime,
        getStorage: () => this.getStorage(),
        semantic: this.#semantic,
        warn: message => this.logger.warn(message),
        maxTokens: this.#tools.maxTokens,
        ...(principals ? { principals } : {}),
        ...(options?.author ? { author: options.author } : {}),
      },
      this.#groups(options),
      // A pin write changes what the pins lane shows; drop the turn's memoized read.
      context =>
        (
          context as KnowledgeRunContext & { requestContext?: { delete?(key: string): void } }
        )?.requestContext?.delete?.(PINNED_READ_MEMO_KEY),
    );
  }

  /**
   * Creates or updates the page at `scope#path`, for apps that sync content in from outside an agent
   * run (a docs site, a CMS). The path is the page's identity, so running a sync again updates the
   * same pages; an unchanged page is not written. Notes on the page are kept. The page is embedded
   * when Knowledge has `vector` and `embedder`, and change listeners are told.
   *
   * **Host-only.** No run scopes and no access rules are checked; who reads the page is decided by
   * the scope's access rules as usual (`explainAccess` explains run access, not host writes). Never
   * expose it through an agent tool, or through a server route without admin-level auth. A scope
   * first created here gets its `belongsTo` parent when a run holding that parent first uses it.
   *
   * @experimental
   */
  upsertPage(input: KnowledgeUpsertPageInput): Promise<KnowledgeUpsertPageResult> {
    return upsertKnowledgePage(this.#hostWriter(), input);
  }

  /**
   * Deletes the page at `scope#path`; `null` when there is none. Refuses a page with child pages
   * and a page declared in config. Host-only, like {@link Knowledge.upsertPage}. Not retried: a
   * concurrent write to the same page between the read and the delete throws, so remove from one
   * sync worker or retry the call. Pass `expected` to delete only the page you read, at the version
   * you read: anything else at the path throws `KnowledgeConflictError` and nothing is deleted.
   *
   * @experimental
   */
  removePage(input: KnowledgeRemovePageInput): Promise<KnowledgePage | null> {
    return removeKnowledgePage(this.#hostWriter(), input);
  }

  /**
   * Moves the page at `scope#path`, with its subtree, under the page at `parent` (a key path; left
   * out, the top of the scope), in `toScope` when given. The page keeps its id, notes, pins and
   * vectors; paths below it change, and links by path are re-resolved. Throws
   * `KnowledgeNotFoundError` for a missing page or parent, and refuses a page declared in config, a
   * move into its own subtree, a key the new parent already has, and a move past the depth limit.
   * Host-only, like {@link Knowledge.upsertPage}. Not retried: a concurrent write to the page
   * between the read and the move throws.
   *
   * @experimental
   */
  movePage(input: KnowledgeMovePageInput): Promise<KnowledgePage> {
    return moveKnowledgePage(this.#hostWriter(), input);
  }

  /**
   * Adds a note to the page at `scope#path`; throws when there is no page there. Readers of the
   * `stamps` scopes (default: the page's scope) see it. Keep the returned id to edit or remove it.
   * Host-only, like {@link Knowledge.upsertPage}.
   *
   * @experimental
   */
  addNote(input: KnowledgeAddNoteInput): Promise<KnowledgeNote> {
    return addKnowledgeNote(this.#hostWriter(), input);
  }

  /**
   * Replaces a note's text. Notes are immutable, so this adds the new note and then removes the old
   * one: the result has a **new id**. If removing the old note fails after the add, both exist;
   * call `removeNote` with the old id. Host-only, like {@link Knowledge.upsertPage}.
   *
   * @experimental
   */
  updateNote(input: KnowledgeUpdateNoteInput): Promise<KnowledgeNote> {
    return updateKnowledgeNote(this.#hostWriter(), input);
  }

  /**
   * Removes a note; `null` when it is already gone. Host-only, like {@link Knowledge.upsertPage}.
   *
   * @experimental
   */
  removeNote(input: { id: string; author?: string }): Promise<KnowledgeNote | null> {
    return removeKnowledgeNote(this.#hostWriter(), input);
  }

  /**
   * The app's importers: `host` applies flushes to this Knowledge's storage, and `run` runs one
   * binding's importer through it. Undefined without `importers` in the config. Host-only, like
   * {@link Knowledge.upsertPage}: never expose `run` without admin-level auth.
   *
   * @experimental
   */
  get importers(): KnowledgeImporters | undefined {
    const importers = this.#importers;
    if (!importers) return undefined;
    const host = createKnowledgeImporterHost(this, { bindings: importers.map(importer => importer.binding) });
    return {
      host,
      run: (bindingId, options) => runKnowledgeImport({ ...options, importers, host, bindingId }),
    };
  }

  static {
    hostWriterOf = knowledge => knowledge.#hostWriter();
  }

  #hostWriter(): KnowledgeHostWriter {
    return {
      runtime: this.#runtime,
      getStorage: () => this.getStorage(),
      semantic: this.#semantic,
      warn: (message: string) => this.logger.warn(message),
    };
  }

  /**
   * Rebuilds the page link index from every page body, for pages written before the index existed
   * or straight to the store. Needs no vector store. Returns how many pages were indexed.
   *
   * @experimental
   */
  async reindexLinks(): Promise<number> {
    return reindexKnowledgeLinks(await this.getStorage());
  }

  /**
   * Embeds pages and notes that already exist, without changing them: content written before a
   * `vector` and `embedder` were configured, or before switching embedders. Each call handles up to
   * `limit` pages (default 50, at most 500) with their notes and returns `nextCursor`; pass it to the
   * next call until it's absent. Handling a page again overwrites its vectors, so a run can stop and
   * resume. Failures are listed, not thrown; if the embedder keeps rate limiting, the call stops
   * early with `rateLimited: true` and a cursor that resumes where it stopped, mid-page if need be; wait before resuming. The
   * cursor is not a snapshot: pages added or removed during a run can be missed or handled twice, and
   * a page read before a concurrent edit can overwrite the vectors that edit wrote, so rerun after
   * concurrent writes finish. Throws without `vector` and `embedder`.
   *
   * @experimental
   */
  async reembed(options?: KnowledgeReembedOptions): Promise<KnowledgeReembedResult> {
    if (!this.#semantic) throw new Error('Knowledge has no `vector` and `embedder` to embed into.');
    return reembedKnowledge(await this.getStorage(), this.#semantic, options);
  }

  /** The usage block that goes with `createTools(options)`. */
  getInstructions(options?: KnowledgeToolSelection): string {
    return buildKnowledgeInstructions(this.#groups(options), this.#instructions);
  }

  /** Whether attached agents get pinned context delivered every turn. */
  get pinnedContextEnabled(): boolean {
    return this.#pins !== false;
  }

  /** Which tool groups `createTools()` and `getInstructions()` include by default. @internal */
  get __toolGroups(): { read: boolean; write: boolean } {
    const { read, write } = this.#groups();
    return { read, write };
  }

  /** The run's principals as a stable key; throws when the run has none or holds an undeclared scope. @internal */
  __principalsKey(context: KnowledgeRunContext): string {
    return knowledgeRunPrincipals(this.#runtime, context).sort().join('\n');
  }

  /**
   * The pinned pages a host-run caller with these principals receives, rendered as an agent run
   * receives them: only pages they can read, within this instance's pin budget. For hosts that serve
   * Knowledge outside an agent run, alongside {@link Knowledge.createTools} with `principals`. Pass the
   * same `read` as that `createTools` call, so entries name read tools only when the caller has them.
   */
  async getPinnedContext(options: { principals: readonly string[]; read?: boolean }): Promise<PinEntry[]> {
    const principals = this.#hostPrincipals(options.principals);
    const budget = this.#pins || resolvePins(true);
    if (!budget) return [];
    const run = await KnowledgeRun.start(this.#runtime, await this.getStorage(), undefined, { principals });
    return knowledgeDeliveredPins(run, budget, this.#groups({ read: options.read }).read);
  }

  // Only the shape is checked here: whether each principal matches a declared scope type is checked
  // when a call starts its run, after the store's declarations have loaded.
  #hostPrincipals(principals: readonly string[]): string[] {
    const unique = [...new Set(principals)];
    if (unique.length === 0) throw new Error('Knowledge `principals` needs at least one scope address.');
    return unique;
  }

  /** The pinned pages a run receives this turn. @internal */
  async __deliveredPins(context: KnowledgeRunContext): Promise<PinEntry[]> {
    const budget = this.#pins || resolvePins(true);
    if (!budget) return [];
    const run = await KnowledgeRun.start(this.#runtime, await this.getStorage(), context);
    return knowledgeDeliveredPins(run, budget, this.#groups().read);
  }

  /** @internal */
  __registerMastra(_mastra: Mastra): void {}

  /** @internal */
  __sharesStorageWith(other: Knowledge): boolean {
    if (!this.#storageSource || !other.#storageSource) return false;
    if (this.#storageSource === other.#storageSource) return true;

    const domain = this.#storageSource.stores?.knowledge;
    const otherDomain = other.#storageSource.stores?.knowledge;
    return (
      domain !== undefined &&
      otherDomain !== undefined &&
      domain.getStorageIsolationKey() === otherDomain.getStorageIsolationKey()
    );
  }

  /** @internal */
  __usesStorage(storage: MastraCompositeStore): boolean {
    const source = getStorageSource(storage);
    if (this.#storageSource === source) return true;

    const domain = this.#storageSource?.stores?.knowledge;
    const sourceDomain = source.stores?.knowledge;
    return (
      domain !== undefined &&
      sourceDomain !== undefined &&
      domain.getStorageIsolationKey() === sourceDomain.getStorageIsolationKey()
    );
  }

  /** @internal */
  setStorage(storage: MastraCompositeStore, source: MastraCompositeStore = storage): void {
    if (this.hasOwnStorage) return;
    this.#storageSource = getStorageSource(source);
    this.#storage = augmentWithInit(storage);
    this.#storagePromise = undefined;
  }

  async getStorage(): Promise<KnowledgeStorage> {
    if (!this.#storagePromise) {
      const promise = this.#resolveStorage().catch(error => {
        if (this.#storagePromise === promise) {
          this.#storagePromise = undefined;
        }
        throw error;
      });
      this.#storagePromise = promise;
    }
    return this.#storagePromise;
  }

  async #resolveStorage(): Promise<KnowledgeStorage> {
    if (!this.#storage) {
      throw new Error(
        'Knowledge requires a storage provider. Configure storage on the Knowledge instance or on the owning Mastra instance.',
      );
    }
    const storage = await this.#storage.getStore('knowledge');
    if (!storage) {
      throw new Error('The configured storage provider does not provide a Knowledge storage domain.');
    }
    return emitKnowledgeChanges(
      storage,
      change => this.#emit(change),
      () => this.#listeners.size > 0,
      error => this.logger.error('Knowledge change event failed after a committed write', { error }),
    );
  }

  #emit(change: Omit<KnowledgeChangeEvent, 'knowledgeId' | 'at'>) {
    if (this.#listeners.size === 0) return;
    const event = { ...change, knowledgeId: this.id, at: new Date() } as KnowledgeChangeEvent;
    for (const listener of this.#listeners) {
      try {
        listener(event);
      } catch (error) {
        this.logger.error('Knowledge change listener threw', { error });
      }
    }
  }

  /**
   * Calls `listener` after each committed write made through this instance's store
   * (`getStorage()`): tool writes, host writes, importer runs and scope creation. Writes in a
   * transaction are reported once it commits. Writes made on a store obtained some other way aren't seen. Events carry ids, not content and not access: anything that relays
   * them to people must re-read each page under that person's read scope. Returns an unsubscribe.
   */
  onChange(listener: KnowledgeChangeListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /**
   * The declaration a scope page was created from, by its `declaration` key (template children
   * included, e.g. `account:$orgId:$accountId/internal`), for display. Access rules are left out;
   * use `explainAccess` for those. `undefined` for an unknown key. Reads the declarations as last
   * resolved, not storage; see {@link Knowledge.resolveScopeDeclarations}.
   */
  scopeDeclaration(key: string): KnowledgeScopeDeclarationInfo | undefined {
    const compiled = this.#runtime.compiled.declarations.get(key);
    if (!compiled) return undefined;
    const { description, displayLabel, belongsTo } = compiled.declaration;
    return {
      key,
      ...(description !== undefined && { description }),
      ...(displayLabel !== undefined && { displayLabel }),
      ...(belongsTo !== undefined && { belongsTo }),
      children: compiled.children.map(child => ({
        key: child.key,
        name: child.child!.name,
        ...(child.declaration.description !== undefined && { description: child.declaration.description }),
        ...(child.declaration.displayLabel !== undefined && { displayLabel: child.declaration.displayLabel }),
      })),
    };
  }

  /**
   * The display label for a canonical scope address (template children included), with the
   * declaration's `$params` filled in from the address's decoded values: `'$orgId policy'` on
   * `policy:$orgId` gives `'acme policy'` for `policy:acme`. A concrete address's own `displayLabel`
   * wins over its pattern's. `undefined` when the address matches no declaration or has no label.
   * Reads the declarations as last resolved, like {@link Knowledge.scopeDeclaration}.
   */
  scopeLabel(address: string): string | undefined {
    const match = this.#runtime.compiled.match(address);
    const label = match?.concrete?.displayLabel ?? match?.compiled.declaration.displayLabel;
    if (label === undefined) return undefined;
    return label.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (token, name: string) =>
      Object.hasOwn(match!.params, name) ? match!.params[name]! : token,
    );
  }
}

export * from '../storage/domains/knowledge';
export type { KnowledgeInstructionParts, KnowledgeInstructionsOption } from './instructions';
/** Read-only readers over the schema-4 page store, for browsing UIs. */
export {
  DEFAULT_KNOWLEDGE_PAGE_GRAPH_LIMITS,
  listKnowledgeTreeChildren,
  MAX_KNOWLEDGE_EXPLORER_PAGE_LINKS,
  MAX_KNOWLEDGE_LINK_COUNT_PAGES,
  readKnowledgePage,
  readKnowledgePageLinkCounts,
  readKnowledgePageLinks,
  readKnowledgePageActivity,
  readKnowledgePageGraph,
  readKnowledgeScopeGrants,
  searchKnowledgeExplorerPages,
} from './explorer-pages';
export type {
  KnowledgeGraphScopeGrant,
  KnowledgePageGraph,
  KnowledgePageGraphEdge,
  KnowledgePageGraphLimits,
  KnowledgePageLinks,
  KnowledgePageView,
  KnowledgeTreeChildren,
  KnowledgeTreePage,
} from './explorer-pages';
export type { KnowledgeConfig } from './config';
export type { PinEntry as KnowledgePinnedEntry } from './pinned';
export { knowledgeScopeAddress, knowledgeMemoryScopes, KnowledgeDeclarationError } from './declarations';
export { decodeKnowledgeScopeId, encodeKnowledgeScopeId } from './scope-address';
export type {
  KnowledgePageTemplate,
  KnowledgePinnedList,
  KnowledgeScopeDeclaration,
  KnowledgeScopeDeclarationInfo,
  KnowledgeScopeDeclarations,
  KnowledgeAccessRule,
  KnowledgeRole,
} from './declarations';
import { KnowledgeSemanticIndex } from './semantic';
export type { KnowledgeAccessExplanation } from './scope-runtime';
export type { KnowledgeAccessGrant } from './access';

/** One principal scope's strongest declared role on a scope. See {@link Knowledge.scopeGrants}. @experimental */
export interface KnowledgeScopeGrant {
  /** The principal scope address, e.g. `role:acme:support`. */
  principal: string;
  role: KnowledgeRole;
}
export type { KnowledgeChangeEvent, KnowledgeChangeListener } from './changes';
export type { KnowledgeReembedOptions, KnowledgeReembedResult } from './reembed';
export type {
  KnowledgeAddNoteInput,
  KnowledgeMovePageInput,
  KnowledgeRemovePageInput,
  KnowledgeUpdateNoteInput,
  KnowledgeUpsertPageInput,
  KnowledgeUpsertPageResult,
} from './host-writes';
export * from './importers';

/** @experimental */
export type KnowledgeImporterHostOptions = LocalKnowledgeImporterHostOptions;

/**
 * An importer host over this Knowledge's storage, for a host that applies flushes for bindings it
 * keeps itself and runs no importer code (a service that importers in other processes flush to).
 * Pass `bindings` as a function to read them at each run start. An app that runs its own importers
 * uses `new Knowledge({ importers: [...] })` and `knowledge.importers` instead.
 *
 * Host-only, like {@link Knowledge.upsertPage}: never expose it without admin-level auth.
 *
 * @experimental
 */
export function createKnowledgeImporterHost(
  knowledge: Knowledge,
  options: KnowledgeImporterHostOptions,
): KnowledgeImporterServiceHost {
  return createLocalKnowledgeImporterHost(hostWriterOf(knowledge), options);
}

/** @experimental */
export interface KnowledgeImporters {
  host: KnowledgeImporterHost;
  run(
    bindingId: string,
    options?: Omit<RunKnowledgeImportOptions, 'importers' | 'host' | 'bindingId'>,
  ): Promise<RunKnowledgeImportResult>;
}
