import { getRunAgentScopes } from '../agent/scopes';
import type {
  KnowledgePage,
  KnowledgeProvenance,
  KnowledgeReadScope,
  KnowledgeStorage,
} from '../storage/domains/knowledge';
import { knowledgeScopeReadable } from '../storage/domains/knowledge';
import { knowledgeRoleOn } from './access';
import { knowledgeRoleAtLeast, knowledgeRunScopes } from './declarations';
import type { KnowledgeRole } from './declarations';
import type { KnowledgeScopeRuntime } from './scope-runtime';

/** What tools receive as their second argument. */
export type KnowledgeRunContext = {
  agent?: { threadId?: string; resourceId?: string; agentId?: string };
  requestContext?: { get(key: string): unknown };
};

/** A page reference the run can't resolve; identical for missing and unreadable pages. */
export class KnowledgeNotFoundError extends Error {
  constructor(ref: string) {
    super(`Knowledge page "${ref}" not found.`);
    this.name = 'KnowledgeNotFoundError';
  }
}

const NAME_CANDIDATES = 5;

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
  ): Promise<KnowledgeRun> {
    const principals = knowledgeRunPrincipals(runtime, context);
    const author = context?.agent?.agentId ? `agent:${context.agent.agentId}` : 'agent';
    const provenance: KnowledgeProvenance = {
      author,
      ...(context?.agent?.threadId ? { sourceThreadId: context.agent.threadId } : {}),
    };
    // Held scopes are host-vouched, so they materialize (and late-link) on first use.
    for (const principal of principals) await runtime.materializeScope(principal, principals, provenance);
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
   * `<scope>#<key>`, or an exact name (ambiguous names are refused with candidate ids).
   */
  async page(ref: string): Promise<KnowledgePage> {
    const byId = await this.storage.getPage({ id: ref, read: this.read });
    if (byId && !byId.deletedAt) return byId;

    const hash = ref.indexOf('#');
    if (hash > 0) {
      const scope = await this.#readableScope(ref.slice(0, hash));
      const key = ref.slice(hash + 1);
      const page =
        scope && key && !key.includes('#')
          ? await this.storage.getPageByKey({ scopeId: scope.id, key, read: this.read })
          : null;
      if (!page) throw new KnowledgeNotFoundError(ref);
      return page;
    }

    if (this.runtime.compiled.match(ref)) {
      const scope = await this.#readableScope(ref);
      if (scope) return scope;
    }

    const named = await this.storage.findPagesByName({ name: ref, read: this.read, limit: NAME_CANDIDATES });
    if (named.length === 1) return named[0]!;
    if (named.length > 1) {
      throw new Error(
        `Knowledge page name "${ref}" is ambiguous; use one of these ids: ${named
          .map(page => `${page.id} (in ${page.scopeId})`)
          .join(', ')}.`,
      );
    }
    throw new KnowledgeNotFoundError(ref);
  }

  async #readableScope(address: string): Promise<KnowledgePage | null> {
    let [scope] = await this.storage.getScopesByAddress([address]);
    // A declared scope the run's rules reach materializes on first use, with its template pages.
    if (!scope && knowledgeRoleOn(this.runtime.compiled, this.principals, { address })) {
      scope = await this.runtime.materializeScope(address, this.principals, this.provenance);
    }
    return scope && knowledgeScopeReadable(scope, this.read) ? scope : null;
  }
}

/**
 * The run's principals in canonical form: its resolved run scopes plus its Memory identity. Every one
 * must match a declared scope type. Read-only scope entries were removed from Knowledge's model, so a
 * run carrying one fails closed instead of getting whatever the rules give.
 * @internal
 */
export function knowledgeRunPrincipals(
  runtime: KnowledgeScopeRuntime,
  context: KnowledgeRunContext | undefined,
): string[] {
  const entries = getRunAgentScopes(context?.requestContext);
  const readOnly = entries.filter(entry => entry.access === 'read').map(entry => entry.scope);
  if (readOnly.length > 0) {
    throw new Error(
      `Read-only scope entries were removed; declare roles in Knowledge scopes instead (${readOnly.join(', ')}).`,
    );
  }
  const raw = entries.map(entry => entry.scope);
  if (context?.agent?.resourceId) raw.push(`resource:${context.agent.resourceId}`);
  if (context?.agent?.threadId) raw.push(`thread:${context.agent.threadId}`);
  if (raw.length === 0) {
    throw new Error('Knowledge tools need run scopes: give the agent or the call `scopes`, or run it with Memory.');
  }
  return knowledgeRunScopes(runtime.compiled, raw);
}
