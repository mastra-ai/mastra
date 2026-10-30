import { randomUUID } from 'node:crypto';
import { MastraBase } from '../base';
import type { Mastra } from '../mastra';
import type { MastraCompositeStore } from '../storage';
import type { KnowledgeReadScope, KnowledgeStorage } from '../storage/domains/knowledge';
import { augmentWithInit, getStorageSource } from '../storage/storageWithInit';
import type { ToolAction } from '../tools';
import { emitKnowledgeChanges } from './changes';
import type { KnowledgeChangeEvent, KnowledgeChangeListener } from './changes';
import type { KnowledgeConfig } from './config';
import { KnowledgeDeclarationError } from './declarations';
import type { KnowledgeScopeDeclarationInfo } from './declarations';
import { buildKnowledgeInstructions } from './instructions';
import type { KnowledgeInstructionsOption } from './instructions';
import { buildKnowledgePageTools } from './page-tools';
import { DEFAULT_MAX_PINS, DEFAULT_PINNED_MAX_TOKENS, knowledgeDeliveredPins, MAX_PINNED_MAX_TOKENS } from './pinned';
import type { PinBudget, PinEntry } from './pinned';
import { PINNED_READ_MEMO_KEY } from './pinned-state-processor';
import { KnowledgeRun, knowledgeRunPrincipals } from './run';
import type { KnowledgeRunContext } from './run';
import { KnowledgeScopeRuntime } from './scope-runtime';
import type { KnowledgeAccessExplanation } from './scope-runtime';

function resolvePins(pins: KnowledgeConfig['pinnedContext']): false | PinBudget {
  if (!pins) return false;
  const options = pins === true ? {} : pins;
  const maxTokens = options.maxTokens ?? DEFAULT_PINNED_MAX_TOKENS;
  if (maxTokens > MAX_PINNED_MAX_TOKENS) {
    throw new Error(`Knowledge pinnedContext.maxTokens is at most ${MAX_PINNED_MAX_TOKENS}.`);
  }
  return { maxPins: options.maxPins ?? DEFAULT_MAX_PINS, maxTokens };
}

/** Below this share of the pin budget each, config pins are too cut down to be useful. */
const MIN_TOKENS_PER_CONFIG_PIN = 50;

/** Overrides which tool groups `createTools` and `getInstructions` cover. */
type KnowledgeToolSelection = { read?: boolean; write?: boolean; pinnedContext?: boolean };

/** @experimental Knowledge APIs are experimental and may change without notice. */
export class Knowledge extends MastraBase {
  readonly id: string;
  readonly hasOwnStorage: boolean;

  readonly description?: string;

  #storage?: MastraCompositeStore;
  #storageSource?: MastraCompositeStore;
  #storagePromise?: Promise<KnowledgeStorage>;
  #runtime: KnowledgeScopeRuntime;
  #tools: { read: boolean; write: boolean };
  #pins: false | PinBudget;
  #instructions?: KnowledgeInstructionsOption;
  #semantic?: KnowledgeSemanticIndex;
  #listeners = new Set<KnowledgeChangeListener>();

  /** Config pins are never dropped, so a scope with more of them than the budget holds is a setup mistake. */
  #warnOnPinOvercommit(budget: PinBudget) {
    const { declarations, concrete } = this.#runtime.compiled;
    const entries: Array<[string, string[] | undefined]> = [
      ...[...declarations.values()].map(
        compiled => [compiled.key, compiled.declaration.pinnedContext] as [string, string[] | undefined],
      ),
      ...[...concrete].map(
        ([address, entry]) => [address, entry.declaration.pinnedContext] as [string, string[] | undefined],
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
        ? { read: Boolean(tools.read), write: Boolean(tools.write) }
        : { read: Boolean(tools), write: Boolean(tools) };
    this.#pins = resolvePins(config.pinnedContext);
    this.#instructions = config.instructions;
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
  readScopeFor(principals: readonly string[]): Promise<KnowledgeReadScope> {
    return this.#runtime.readScopeFor(principals);
  }

  /**
   * Why a run holding `runScopes` can or can't reach a scope or page: its role there and the rules
   * that give it. `runScopes` are raw run scopes, as passed to an agent run; undeclared ones throw
   * like they do at run start. `target` is a scope address, or a page id or `<scope>#<key>[/<key>…]`.
   *
   * **Host-only.** It tells a missing page from a hidden one, which runs must never learn. Never
   * expose it through an agent tool, or through a server route without admin-level auth.
   *
   * @experimental
   */
  explainAccess(
    runScopes: readonly string[],
    target: { scope: string } | { page: string },
  ): Promise<KnowledgeAccessExplanation> {
    return this.#runtime.explainAccess(runScopes, target);
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
  renameScopeDeclaration(from: string, to: string): Promise<number> {
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
  createTools(options?: KnowledgeToolSelection): Record<string, ToolAction<any, any, any>> {
    return buildKnowledgePageTools(
      {
        runtime: this.#runtime,
        getStorage: () => this.getStorage(),
        semantic: this.#semantic,
        warn: message => this.logger.warn(message),
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
   * Re-embeds every live page and note into the vector store, for content written outside the tools
   * or after a failed embed. Returns how many were indexed; throws without `vector` and `embedder`.
   */
  async reindex(): Promise<number> {
    if (!this.#semantic) throw new Error('Knowledge has no `vector` and `embedder` to reindex into.');
    return this.#semantic.reindex(await this.getStorage());
  }

  /** The usage block that goes with `createTools(options)`. */
  getInstructions(options?: KnowledgeToolSelection): string {
    return buildKnowledgeInstructions(this.#groups(options), this.#instructions);
  }

  /** Whether attached agents get pinned context delivered every turn. */
  get pinnedContextEnabled(): boolean {
    return this.#pins !== false;
  }

  /** The run's principals as a stable key; throws when the run has none or holds an undeclared scope. @internal */
  __principalsKey(context: KnowledgeRunContext): string {
    return knowledgeRunPrincipals(this.#runtime, context).sort().join('\n');
  }

  /** The pinned pages a run receives this turn. @internal */
  async __deliveredPins(context: KnowledgeRunContext): Promise<PinEntry[]> {
    const budget = this.#pins || resolvePins(true);
    if (!budget) return [];
    const run = await KnowledgeRun.start(this.#runtime, await this.getStorage(), context);
    return knowledgeDeliveredPins(run, budget);
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
   * (`getStorage()`): tool writes, host writes and scope creation. Writes made on a store obtained
   * some other way aren't seen. Events carry ids, not content and not access: anything that relays
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
   * use `explainAccess` for those. `undefined` for an unknown key.
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
export type { KnowledgeConfig } from './config';
export { knowledgeScopeAddress, knowledgeMemoryScopes, KnowledgeDeclarationError } from './declarations';
export type {
  KnowledgePageTemplate,
  KnowledgeScopeDeclaration,
  KnowledgeScopeDeclarationInfo,
  KnowledgeScopeDeclarations,
  KnowledgeAccessRule,
  KnowledgeRole,
} from './declarations';
import { KnowledgeSemanticIndex } from './semantic';
export type { KnowledgeAccessExplanation } from './scope-runtime';
export type { KnowledgeAccessGrant } from './access';
export type { KnowledgeChangeEvent, KnowledgeChangeListener } from './changes';
