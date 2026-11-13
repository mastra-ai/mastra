import { getRunAgentScopes, withoutIdentityAgentScopes } from '../agent/scopes';
import type {
  KnowledgePage,
  KnowledgeProvenance,
  KnowledgeReadScope,
  KnowledgeStorage,
} from '../storage/domains/knowledge';
import { knowledgeScopeReadable, parseKnowledgePageRef } from '../storage/domains/knowledge';
import { knowledgeRoleOn } from './access';
import {
  KnowledgeDeclarationError,
  knowledgeRoleAtLeast,
  knowledgeRunScopes,
  knowledgeScopeAddress,
} from './declarations';
import type { KnowledgeRole } from './declarations';
import { knowledgePageRefs } from './page-refs';
import type { KnowledgeScopeRuntime } from './scope-runtime';

/** What tools receive as their second argument. */
export type KnowledgeRunContext = {
  agent?: { threadId?: string; resourceId?: string; agentId?: string };
  requestContext?: { get(key: string): unknown };
};

/** A page reference the run can't resolve; identical for missing and unreadable pages. */
export class KnowledgeNotFoundError extends Error {
  constructor(ref: string, closeMatches: string[] = []) {
    super(
      `Knowledge page "${ref}" not found.${closeMatches.length ? ` Close matches: ${closeMatches.join('; ')}.` : ''}`,
    );
    this.name = 'KnowledgeNotFoundError';
  }
}

const NAME_CANDIDATES = 5;
const CLOSE_MATCHES = 3;

/**
 * One call's view of Knowledge: the run's principals, its read scope and its provenance. Built per
 * tool call from the run's own scopes, so access always follows the current declarations.
 * @internal
 */
export class KnowledgeRun {
  private constructor(
    readonly runtime: KnowledgeScopeRuntime,
    readonly storage: KnowledgeStorage,
    readonly principals: string[],
    readonly read: Exclude<KnowledgeReadScope, 'all'>,
    readonly provenance: KnowledgeProvenance,
  ) {}

  static async start(
    runtime: KnowledgeScopeRuntime,
    storage: KnowledgeStorage,
    context: KnowledgeRunContext | undefined,
    options: { write?: boolean } = {},
  ): Promise<KnowledgeRun> {
    const principals = knowledgeRunPrincipals(runtime, context);
    const author = context?.agent?.agentId ? `agent:${context.agent.agentId}` : 'agent';
    const provenance: KnowledgeProvenance = {
      author,
      ...(context?.agent?.threadId ? { sourceThreadId: context.agent.threadId } : {}),
    };
    // Held scopes are host-vouched, so a writing run materializes (and late-links) them. Reads create
    // nothing: a scope with no pages yet reads the same as one that doesn't exist.
    if (options.write) {
      await runtime.materializeScopes(principals, principals, provenance);
    }
    const read = (await runtime.readScopeFor(principals)) as Exclude<KnowledgeReadScope, 'all'>;
    return new KnowledgeRun(runtime, storage, principals, read, provenance);
  }

  /** The strongest role on a scope page, or null. */
  async roleOn(scope: KnowledgePage): Promise<KnowledgeRole | null> {
    return this.runtime.roleOn(this.principals, scope);
  }

  /** The home scope page of a page the run can read. */
  async scopeOf(page: KnowledgePage): Promise<KnowledgePage> {
    if (page.isScope) return page;
    const scope = await this.storage.getPage({ id: page.scopeId, read: this.read });
    if (!scope) throw new Error(`Knowledge page "${page.id}" has no readable home scope.`);
    return scope;
  }

  /** Throws unless the run holds at least `min` on `scope`. */
  async require(scope: KnowledgePage, min: KnowledgeRole, action: string): Promise<void> {
    const role = await this.roleOn(scope);
    if (!knowledgeRoleAtLeast(role, min)) {
      throw new Error(`${action} needs ${min} on "${scope.address}"; this run has ${role ? role : 'no role'} there.`);
    }
  }

  /**
   * A scope a write names (create home, move destination, note stamp). Unmaterialized scopes are
   * created only when the run's rules already give it at least `min` there, so a model can't spawn
   * scope pages it couldn't write to.
   */
  async targetScope(address: string, min: KnowledgeRole, action: string): Promise<KnowledgePage> {
    const match = this.runtime.compiled.match(address);
    if (!match) throw new Error(`Knowledge scope "${address}" does not match a declared scope type.`);
    let [scope] = await this.storage.getScopesByAddress([address]);
    if (!scope) {
      const role = knowledgeRoleOn(this.runtime.compiled, this.principals, { address });
      if (!knowledgeRoleAtLeast(role, min)) throw new KnowledgeNotFoundError(address);
      scope = await this.runtime.materializeScope(address, this.principals, this.provenance);
    }
    const role = await this.roleOn(scope);
    if (!role) throw new KnowledgeNotFoundError(address);
    if (!knowledgeRoleAtLeast(role, min)) {
      throw new Error(`${action} needs ${min} on "${address}"; this run has ${role} there.`);
    }
    return scope;
  }

  /**
   * Resolves a page reference through the run's read view: a page id, a scope address,
   * `<scope>#<key>[/<key>…]` (walked key by key), or an exact name (ambiguous names are refused with candidate ids).
   * A scope that hasn't been created yet is not found, unless `createAt` is given and the run's rules give it at
   * least that role there: model-supplied references never create scope pages on a read.
   */
  async page(ref: string, createAt?: KnowledgeRole): Promise<KnowledgePage> {
    const byId = await this.storage.getPage({ id: ref, read: this.read });
    if (byId && !byId.deletedAt) return byId;

    if (ref.indexOf('#') > 0) {
      const parsed = parseKnowledgePageRef(ref);
      const scope = parsed ? await this.#readableScope(parsed.scope, createAt) : undefined;
      const page =
        parsed && scope
          ? await this.storage.getPageByPath({ scopeId: scope.id, path: parsed.path, read: this.read })
          : null;
      if (!page) throw new KnowledgeNotFoundError(ref);
      return page;
    }

    if (this.runtime.compiled.match(ref)) {
      const scope = await this.#readableScope(ref, createAt);
      if (scope) return scope;
    }

    const named = await this.storage.findPagesByName({ name: ref, read: this.read, limit: NAME_CANDIDATES });
    if (named.length === 1) return named[0]!;
    if (named.length > 1) {
      const { refs } = await knowledgePageRefs(this.storage, this.read, named);
      throw new Error(
        `Knowledge page name "${ref}" is ambiguous; use one of these refs: ${named
          .map(page => refs.get(page.id) ?? page.id)
          .join(', ')}.`,
      );
    }
    throw new KnowledgeNotFoundError(ref);
  }

  /**
   * {@link page}, but a miss names up to a few readable pages whose name or path matches the ref's last
   * segment, by full ref, so a model that guessed a path can read the right one next. Costs one search on a miss.
   */
  async pageOrCloseMatches(ref: string): Promise<KnowledgePage> {
    try {
      return await this.page(ref);
    } catch (error) {
      if (!(error instanceof KnowledgeNotFoundError)) throw error;
      const hash = ref.indexOf('#');
      const parsed = hash > 0 ? parseKnowledgePageRef(ref) : null;
      const last = parsed ? parsed.path[parsed.path.length - 1]! : ref;
      const query = last.replace(/[-_]+/g, ' ').trim();
      if (!query) throw error;
      const scope = parsed ? (await this.storage.getScopesByAddress([parsed.scope]))[0] : undefined;
      const hits = await this.storage.searchPages({
        query,
        read: this.read,
        ...(scope && knowledgeScopeReadable(scope, this.read) ? { scopeIds: [scope.id] } : {}),
        limit: CLOSE_MATCHES * 2,
      });
      const pages = [...new Map(hits.map(hit => [hit.page.id, hit.page])).values()]
        .filter(page => !page.isScope)
        .slice(0, CLOSE_MATCHES);
      if (pages.length === 0) throw error;
      const { refs } = await knowledgePageRefs(this.storage, this.read, pages);
      throw new KnowledgeNotFoundError(
        ref,
        pages.map(page => `${refs.get(page.id) ?? page.id} (${page.name})`),
      );
    }
  }

  async #readableScope(address: string, createAt: KnowledgeRole | undefined): Promise<KnowledgePage | null> {
    let [scope] = await this.storage.getScopesByAddress([address]);
    // A write materializes a declared scope, with its template pages, when the run's rules let it write there.
    if (
      !scope &&
      createAt &&
      knowledgeRoleAtLeast(knowledgeRoleOn(this.runtime.compiled, this.principals, { address }), createAt)
    ) {
      scope = await this.runtime.materializeScope(address, this.principals, this.provenance);
    }
    return scope && knowledgeScopeReadable(scope, this.read) ? scope : null;
  }
}

/**
 * The run's principals in canonical form: its resolved run scopes plus its Memory identity. Every one
 * must match a declared scope type.
 * @internal
 */
export function knowledgeRunPrincipals(
  runtime: KnowledgeScopeRuntime,
  context: KnowledgeRunContext | undefined,
): string[] {
  // Identity comes only from the resolved Memory ids below. Core already strips resource:/thread: from
  // the run's scopes; one written there anyway is raw Memory syntax, not a canonical address.
  const raw = withoutIdentityAgentScopes(getRunAgentScopes(context?.requestContext));
  // Memory ids are app-chosen and may contain colons (`slack:U123`), so they're bound encoded rather
  // than parsed back out of a raw `resource:<id>` string.
  const memory: string[] = [];
  if (context?.agent?.resourceId)
    memory.push(knowledgeScopeAddress('resource:$resourceId', { resourceId: context.agent.resourceId }));
  if (context?.agent?.threadId)
    memory.push(knowledgeScopeAddress('thread:$threadId', { threadId: context.agent.threadId }));
  if (raw.length === 0 && memory.length === 0) {
    throw new Error('Knowledge tools need run scopes: give the agent or the call `scopes`, or run it with Memory.');
  }
  for (const address of memory) {
    if (!runtime.compiled.match(address)) {
      throw new KnowledgeDeclarationError(
        `Knowledge run scope "${address}" does not match a declared scope type. Declare it in Knowledge \`scopes\` (for Memory's resource:/thread: scopes, spread \`...knowledgeMemoryScopes()\`).`,
      );
    }
  }
  return [...new Set([...knowledgeRunScopes(runtime.compiled, raw), ...memory])];
}
