import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_SCOPES_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '../request-context';

/**
 * Scope types Memory reads as the run's identity. Every other scope type is
 * arbitrary: Core passes it through without giving it meaning.
 */
const IDENTITY_SCOPE_TYPES = new Set(['resource', 'thread']);

const SCOPE_TYPE_PATTERN = /^[a-z][a-z0-9_-]*$/;

/**
 * Request-context key, next to `mastra__scopes`, listing the run's read-only tags as a frozen
 * `Record<tag, 'read'>`. Trusted only when Core marked it, like `mastra__scopes`.
 */
export const MASTRA_SCOPE_ACCESS_KEY = 'mastra__scopeAccess';

/**
 * A scope an agent run holds: a `type:value` string the run can read, or `{ scope, access }`
 * to say so explicitly; `access: 'write'` lets the run write there too. `resource:` and
 * `thread:` scopes are the run's Memory identity and always writable.
 * @experimental
 */
export type AgentScopeEntry = string | { scope: string; access: 'read' | 'write' };

/** A scope the run holds, with its access. */
export type RunAgentScope = { scope: string; access: 'read' | 'write' };

/** The `type:value` address of a scope entry. */
export function agentScopeEntryTag(entry: AgentScopeEntry): string {
  return typeof entry === 'string' ? entry : entry.scope;
}

/** Whether a scope entry lets the run write: `access: 'write'`, or a Memory identity scope. */
export function agentScopeEntryWrites(entry: AgentScopeEntry): boolean {
  const tag = agentScopeEntryTag(entry);
  if (IDENTITY_SCOPE_TYPES.has(tag.slice(0, tag.indexOf(':')))) return true;
  return typeof entry !== 'string' && entry.access === 'write';
}

export type AgentScopesSnapshot = {
  resourceId?: string;
  threadId?: string;
  /**
   * The full scope set the suspended run resolved, including identity scopes. Present (even
   * empty) means this is a resume: the set is authoritative and Agent configuration is ignored.
   */
  scopes?: readonly string[];
  /** Tags the suspended run held read-only. A resume may narrow more tags to read, never widen one. */
  readOnly?: readonly string[];
};

/**
 * The Agent `scopes` option: a static list added to the run's incoming scopes, or a function that
 * receives the incoming scopes and returns the run's final set.
 * @experimental
 */
export type AgentScopesConfig<TRequestContext = unknown> =
  | AgentScopeEntry[]
  | ((args: {
      /** The run's incoming scopes: the call's `scopes`, `defaultOptions.scopes` and `mastra__scopes`. */
      scopes: AgentScopeEntry[];
      requestContext: RequestContext<TRequestContext>;
      mastra?: any;
    }) => AgentScopeEntry[] | Promise<AgentScopeEntry[]>);

/**
 * Applies an Agent's `scopes` option to a run's incoming scopes: no option keeps them, a static
 * list adds to them, a function replaces them with what it returns.
 */
export async function applyAgentScopesConfig<TRequestContext>(
  config: AgentScopesConfig<TRequestContext> | undefined,
  args: { scopes: AgentScopeEntry[]; requestContext: RequestContext<TRequestContext>; mastra?: unknown },
): Promise<AgentScopeEntry[]> {
  if (config === undefined) return args.scopes;
  if (typeof config !== 'function') return [...args.scopes, ...config];
  return config(args);
}

export type ResolveAgentScopesInput = {
  requestContext?: RequestContext;
  /**
   * The run's scopes after the Agent's `scopes` option ran on the incoming scopes (see
   * `incomingAgentScopes`). When given, it is the run's final set: request-context and call scopes
   * are not added again, but every `resource:`/`thread:` scope among them must still be in it.
   * Ignored on resume.
   */
  agentScopes?: readonly AgentScopeEntry[];
  /** Scopes passed on the call. */
  callScopes?: readonly AgentScopeEntry[];
  memory?: { resource?: string; thread?: string | { id: string } };
  resourceId?: string;
  threadId?: string;
  snapshot?: AgentScopesSnapshot;
  /**
   * The Mastra instance running the agent. When it has a registered server that does not keep
   * request bodies from supplying scopes, scopes from the call and the request context are refused.
   */
  mastra?: { getMastraServer?(): unknown };
};

export type ResolvedAgentScopes = {
  /** The run's full scope set, identity scopes included. */
  scopes: string[];
  /** Tags of `scopes` the run holds read-only. */
  readOnly: string[];
  resourceId?: string;
  threadId?: string;
};

/**
 * `mastra__scopes` values Core wrote onto a run's derived context. Nested runs (sub-agents,
 * Subconscious, tools calling agents) receive these, and they stay trusted behind an older server
 * because a request body cannot produce an object in this set.
 */
const runScopeValues = new WeakSet<object>();

function markRunScopes(scopes: string[]): string[] {
  runScopeValues.add(scopes);
  return scopes;
}

/**
 * The `mastra__scopeAccess` record Core wrote together with each marked `mastra__scopes` array.
 * A run's access is trusted only when the context holds exactly this record next to that array.
 */
const runScopeAccess = new WeakMap<object, Readonly<Record<string, 'read'>>>();

/**
 * Sets `mastra__scopes` to scopes a run derived, and `mastra__scopeAccess` to its read-only tags
 * (an empty record when there are none), marking both as written by Core and binding them together.
 */
export function setRunAgentScopes(
  requestContext: RequestContext<any>,
  scopes: readonly string[],
  readOnly: readonly string[] = [],
): void {
  const marked = markRunScopes([...scopes]);
  const held = new Set(scopes);
  const record = Object.freeze(
    Object.fromEntries(readOnly.filter(tag => held.has(tag)).map(tag => [tag, 'read' as const])),
  );
  runScopeAccess.set(marked, record);
  requestContext.set(MASTRA_SCOPES_KEY, marked);
  requestContext.set(MASTRA_SCOPE_ACCESS_KEY, record);
}

/** Read-only tags from a persisted access map; undefined when absent or malformed. */
export function readOnlyTags(value: unknown): string[] | undefined {
  const tags = accessMapTags(value);
  return tags && tags.length > 0 ? tags : undefined;
}

/** Read-only tags from a request context's access map, whether or not Core marked it. */
function accessMapTags(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return [];
  if (typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.some(([, access]) => access !== 'read')) return undefined;
  return entries.map(([tag]) => tag);
}

/**
 * The run's non-identity scopes with their access, as Core wrote them onto the run's request
 * context. Scopes a host or server supplies (agent config, call `scopes`, a `mastra__scopes` key on
 * the caller's request context) are honored when the run starts, by `resolveAgentScopes`. This
 * reader is for code running inside the run (tools, processors): it returns `[]` unless
 * `mastra__scopes` is the exact array Core marked and `mastra__scopeAccess` is the exact record Core
 * wrote with it, so an array or access map written, replaced or deleted after resolution gives the
 * run nothing.
 */
export function getRunAgentScopes(requestContext: { get(key: string): unknown } | undefined): RunAgentScope[] {
  const scopes = requestContext?.get(MASTRA_SCOPES_KEY);
  if (!Array.isArray(scopes) || !runScopeValues.has(scopes)) return [];
  const access = requestContext?.get(MASTRA_SCOPE_ACCESS_KEY);
  // A missing, replaced or unmarked access map could hide a read-only tag, so the run holds nothing.
  if (access === undefined || access !== runScopeAccess.get(scopes)) return [];
  const readOnly = new Set(Object.keys(access as object));
  return (scopes as string[]).map(scope => ({ scope, access: readOnly.has(scope) ? 'read' : 'write' }));
}

/**
 * Re-marks `mastra__scopes` on a context Core rebuilt from its own persisted run state (durable
 * snapshots, durable step input). The mark does not survive JSON, and these scopes already passed
 * resolution when the run started.
 */
export function restoreRunAgentScopes(requestContext: RequestContext<any>): void {
  const scopes = requestContext.get(MASTRA_SCOPES_KEY);
  const readOnly = accessMapTags(requestContext.get(MASTRA_SCOPE_ACCESS_KEY));
  if (Array.isArray(scopes) && scopes.every(scope => typeof scope === 'string') && readOnly) {
    setRunAgentScopes(requestContext, scopes, readOnly);
  }
}

/**
 * True when Mastra has a registered server that does not mark itself as reserving agent scopes.
 * Such a server (released before agent scopes) passes a request body's `scopes` option and
 * `requestContext.mastra__scopes` through to the agent.
 */
function hasOutdatedScopesServer(mastra: ResolveAgentScopesInput['mastra']): boolean {
  const server = mastra?.getMastraServer?.() as { reservesAgentScopes?: boolean } | undefined;
  return !!server && server.reservesAgentScopes !== true;
}

function assertCallerScopesAllowed(
  input: Pick<ResolveAgentScopesInput, 'mastra' | 'requestContext' | 'callScopes'>,
): void {
  if (!hasOutdatedScopesServer(input.mastra)) return;
  const fromContext = input.requestContext?.get(MASTRA_SCOPES_KEY);
  const contextSupplied =
    Array.isArray(fromContext) && fromContext.length > 0 && !runScopeValues.has(fromContext as object);
  if (!contextSupplied && !input.callScopes?.length) return;
  throw new MastraError({
    id: 'AGENT_SCOPES_SERVER_OUTDATED',
    domain: ErrorDomain.AGENT,
    category: ErrorCategory.USER,
    text:
      `Agent scopes from the call or the "${MASTRA_SCOPES_KEY}" request context key need a @mastra/server release ` +
      'that keeps request bodies from setting them. The registered server is older, so a client could supply them. ' +
      "Upgrade @mastra/server, or set scopes with the Agent's `scopes` option.",
    // Usually triggered by a request body, so it is a client error rather than a 500.
    details: { status: 400 },
  });
}

function scopesError(id: 'AGENT_SCOPES_INVALID' | 'AGENT_SCOPES_CONFLICT', text: string): MastraError {
  return new MastraError({
    id,
    domain: ErrorDomain.AGENT,
    category: ErrorCategory.USER,
    text,
    // Server handlers map `details.status` to the HTTP status.
    details: { status: 400 },
  });
}

/** Splits a scope address on its first colon. Returns undefined for a malformed address. */
export function parseAgentScope(scope: string): { type: string; value: string } | undefined {
  const separator = scope.indexOf(':');
  if (separator <= 0) return undefined;
  const type = scope.slice(0, separator);
  const value = scope.slice(separator + 1);
  if (!SCOPE_TYPE_PATTERN.test(type) || value.length === 0) return undefined;
  return { type, value };
}

function validateScopes(source: string, scopes: unknown): { tags: string[]; readOnly: string[] } {
  if (scopes === undefined || scopes === null) return { tags: [], readOnly: [] };
  if (!Array.isArray(scopes)) {
    throw scopesError('AGENT_SCOPES_INVALID', `Agent ${source} must be an array of "<type>:<value>" strings.`);
  }
  const tags: string[] = [];
  const readOnly: string[] = [];
  for (const entry of scopes) {
    const isObject = typeof entry === 'object' && entry !== null;
    const scope = isObject ? (entry as { scope?: unknown }).scope : entry;
    const access = isObject ? (entry as { access?: unknown }).access : 'read';
    if (typeof scope !== 'string' || (access !== 'read' && access !== 'write')) {
      throw scopesError(
        'AGENT_SCOPES_INVALID',
        `Agent ${source} must contain only "<type>:<value>" strings or { scope, access: 'read' | 'write' } entries.`,
      );
    }
    const parsed = parseAgentScope(scope);
    if (!parsed) {
      throw scopesError(
        'AGENT_SCOPES_INVALID',
        `Invalid agent scope "${scope}" in ${source}. Scopes are "<type>:<value>" addresses with a lowercase type, such as "org:acme" or "thread:t1".`,
      );
    }
    if (IDENTITY_SCOPE_TYPES.has(parsed.type) && parsed.value.includes(':thread:')) {
      throw scopesError(
        'AGENT_SCOPES_INVALID',
        `Invalid agent scope "${scope}" in ${source}. Pass the thread as its own "thread:<id>" scope.`,
      );
    }
    const identity = IDENTITY_SCOPE_TYPES.has(parsed.type);
    if (isObject && identity && access === 'read') {
      throw scopesError(
        'AGENT_SCOPES_INVALID',
        `Invalid agent scope "${scope}" in ${source}. "${parsed.type}:" is the run's Memory identity and can't be read-only.`,
      );
    }
    tags.push(scope);
    if (!identity && access === 'read') readOnly.push(scope);
  }
  return { tags, readOnly };
}

/**
 * The scopes a run starts from before the Agent's `scopes` option: the reserved `mastra__scopes`
 * request-context key, the call's `scopes` and `defaultOptions.scopes`. Read-only entries keep
 * their access, so a function sees what it is given.
 */
export function incomingAgentScopes(input: {
  requestContext?: RequestContext;
  callScopes?: readonly AgentScopeEntry[];
  defaultScopes?: readonly AgentScopeEntry[];
  mastra?: ResolveAgentScopesInput['mastra'];
}): AgentScopeEntry[] {
  assertCallerScopesAllowed(input);
  const fromContext = contextScopes(input.requestContext);
  const call = validateScopes('option "scopes"', input.callScopes);
  const defaults = validateScopes('default option "scopes"', input.defaultScopes);
  const tags = [...new Set([...fromContext.tags, ...call.tags, ...defaults.tags])];
  const readOnly = new Set([...fromContext.readOnly, ...call.readOnly, ...defaults.readOnly]);
  return tags.map(tag =>
    isIdentityAgentScope(tag)
      ? tag
      : { scope: tag, access: readOnly.has(tag) ? ('read' as const) : ('write' as const) },
  );
}

/** Scopes on the request context's `mastra__scopes` key, with the read-only ones. */
function contextScopes(requestContext: RequestContext | undefined): { tags: string[]; readOnly: string[] } {
  const fromContext = validateScopes(`request context "${MASTRA_SCOPES_KEY}"`, requestContext?.get(MASTRA_SCOPES_KEY));
  // Core writes resolved tags with an access map beside them (an empty one when nothing is
  // read-only). A host that sets the key itself writes entries, which read like any others:
  // plain strings read-only, `{ scope, access: 'write' }` writable.
  const accessMap = requestContext?.get(MASTRA_SCOPE_ACCESS_KEY);
  const readOnly = accessMap === undefined || accessMap === null ? fromContext.readOnly : accessMapTags(accessMap);
  if (!readOnly) {
    throw scopesError(
      'AGENT_SCOPES_INVALID',
      `Agent request context "${MASTRA_SCOPE_ACCESS_KEY}" must map tags to "read".`,
    );
  }
  return { tags: fromContext.tags, readOnly };
}

function identityFromScopes(scopes: readonly string[], type: 'resource' | 'thread'): string | undefined {
  let found: string | undefined;
  for (const scope of scopes) {
    const parsed = parseAgentScope(scope);
    if (parsed?.type !== type) continue;
    if (found !== undefined && found !== parsed.value) {
      throw scopesError(
        'AGENT_SCOPES_CONFLICT',
        `Agent scopes contain more than one ${type}: "${type}:${found}" and "${type}:${parsed.value}".`,
      );
    }
    found = parsed.value;
  }
  return found;
}

function assertMatches(
  type: 'resource' | 'thread',
  fromScopes: string,
  sources: ReadonlyArray<readonly [label: string, value: string | undefined]>,
) {
  for (const [label, value] of sources) {
    if (value && value !== fromScopes) {
      throw scopesError(
        'AGENT_SCOPES_CONFLICT',
        `Agent scope "${type}:${fromScopes}" conflicts with ${label} "${value}". Pass the same ${type} in both places, or only one of them.`,
      );
    }
  }
}

function memoryThreadId(memory: ResolveAgentScopesInput['memory']): string | undefined {
  const thread = memory?.thread;
  if (!thread) return undefined;
  return typeof thread === 'string' ? thread : thread.id || undefined;
}

/**
 * Resolves the scopes an agent run acts with, and the Memory resource/thread they imply.
 *
 * The incoming scopes (the reserved `mastra__scopes` request-context key and the call's `scopes`)
 * go through the Agent's `scopes` option first (`agentScopes`): a static list adds to them, a
 * function replaces them. `resource:` and `thread:` scopes set the
 * run's Memory identity; every other source of resource/thread must agree with them or the
 * call throws. Resource and thread resolve independently: when scopes carry neither, the
 * existing precedence applies (reserved ID key, then options, then memory, then snapshot).
 *
 * On resume, the snapshot's scope set is authoritative. Scopes from the call or request
 * context may be any subset of it; a scope the snapshot does not hold throws. The Agent's
 * configured scopes are validated but not applied, so changing them never blocks a resume.
 */
export function resolveAgentScopes(input: ResolveAgentScopesInput): ResolvedAgentScopes {
  const { requestContext, memory, snapshot } = input;
  assertCallerScopesAllowed(input);
  const agentScopes = validateScopes('config "scopes"', input.agentScopes);
  const { tags: fromContextTags, readOnly: contextReadOnly } = contextScopes(requestContext);
  const callScopes = validateScopes('option "scopes"', input.callScopes);
  let supplied: Set<string>;
  let suppliedReadOnly: Set<string>;
  if (input.agentScopes !== undefined && !snapshot?.scopes) {
    // The Agent's `scopes` option already ran on the incoming scopes; its result is the run's set.
    supplied = new Set(agentScopes.tags);
    for (const scope of [...fromContextTags, ...callScopes.tags]) {
      if (isIdentityAgentScope(scope) && !supplied.has(scope)) {
        throw scopesError(
          'AGENT_SCOPES_INVALID',
          `The agent's scopes function dropped "${scope}". A run keeps the "resource:" and "thread:" scopes it was given.`,
        );
      }
    }
    // A tag a parent run held read-only stays read-only; the function can't widen it.
    suppliedReadOnly = new Set([...agentScopes.readOnly, ...contextReadOnly]);
  } else {
    // On resume the Agent's own configuration is not re-supplied by the caller: the suspended run
    // keeps its scopes, so an agent that adds or changes its resolver can still resume older runs.
    supplied = new Set<string>([...fromContextTags, ...callScopes.tags]);
    // Union by tag: any source holding a tag read-only (a plain string included) makes it read-only.
    // Nothing widens it back.
    suppliedReadOnly = new Set<string>([...contextReadOnly, ...callScopes.readOnly]);
  }

  let scopes: string[];
  let readOnly: Set<string>;
  if (snapshot?.scopes) {
    scopes = [...validateScopes('snapshot scopes', snapshot.scopes).tags];
    readOnly = new Set(snapshot.readOnly ?? []);
    for (const tag of readOnly) {
      // A resumed run can narrow a tag to read, never widen it.
      if (callScopes.tags.includes(tag) && !callScopes.readOnly.includes(tag)) {
        throw scopesError(
          'AGENT_SCOPES_CONFLICT',
          `Agent scope "${tag}" was read-only in the suspended run. A resumed run can't widen it to read and write.`,
        );
      }
    }
    for (const tag of suppliedReadOnly) readOnly.add(tag);
    const held = new Set(scopes);
    for (const scope of supplied) {
      if (held.has(scope)) continue;
      // Naming the suspended run's own resource or thread is not a new scope.
      const parsed = parseAgentScope(scope)!;
      const snapshotIdentity =
        parsed.type === 'resource' ? snapshot.resourceId : parsed.type === 'thread' ? snapshot.threadId : undefined;
      if (snapshotIdentity !== undefined && parsed.value === snapshotIdentity) {
        scopes.push(scope);
      } else {
        throw scopesError(
          'AGENT_SCOPES_CONFLICT',
          `Agent scope "${scope}" was not part of the suspended run's scopes. A resumed run keeps the scopes it started with.`,
        );
      }
    }
  } else {
    scopes = [...supplied];
    readOnly = suppliedReadOnly;
  }
  const held = new Set(scopes);

  const resourceFromContext = requestContext?.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
  const threadFromContext = requestContext?.get(MASTRA_THREAD_ID_KEY) as string | undefined;
  const threadFromMemory = memoryThreadId(memory);

  let resourceId = identityFromScopes(scopes, 'resource');
  if (resourceId) {
    assertMatches('resource', resourceId, [
      [`request context "${MASTRA_RESOURCE_ID_KEY}"`, resourceFromContext],
      ['option "resourceId"', input.resourceId],
      ['option "memory.resource"', memory?.resource],
      ['the suspended run resource', snapshot?.resourceId],
    ]);
  } else {
    resourceId = resourceFromContext || input.resourceId || memory?.resource || snapshot?.resourceId;
  }

  let threadId = identityFromScopes(scopes, 'thread');
  if (threadId) {
    assertMatches('thread', threadId, [
      [`request context "${MASTRA_THREAD_ID_KEY}"`, threadFromContext],
      ['option "threadId"', input.threadId],
      ['option "memory.thread"', threadFromMemory],
      ['the suspended run thread', snapshot?.threadId],
    ]);
  } else {
    threadId = threadFromContext || threadFromMemory || input.threadId || snapshot?.threadId;
  }

  return {
    scopes,
    readOnly: [...readOnly].filter(tag => held.has(tag)),
    resourceId: resourceId || undefined,
    threadId: threadId || undefined,
  };
}

/** Returns true when the scope is a Memory identity scope (`resource:` or `thread:`). */
export function isIdentityAgentScope(scope: string): boolean {
  const parsed = parseAgentScope(scope);
  return !!parsed && IDENTITY_SCOPE_TYPES.has(parsed.type);
}

/** The scopes a run passes downstream: its resolved set without `resource:`/`thread:`. */
export function withoutIdentityAgentScopes(scopes: readonly string[]): string[] {
  return scopes.filter(scope => !isIdentityAgentScope(scope));
}

/**
 * Builds the request context a run hands to tools, processors, sub-agents and snapshots.
 *
 * The caller's context is never modified. When the run has scopes, or the caller's context
 * carries `mastra__scopes`, the run works on a copy whose `mastra__scopes` holds only the
 * non-identity scopes, so nested calls that pick a different thread or resource do not
 * conflict with the parent's identity. Otherwise the caller's context is returned as-is.
 */
export function deriveAgentRunRequestContext<T extends RequestContext<any>>(
  requestContext: T,
  scopes: readonly string[],
  readOnly: readonly string[] = [],
): T {
  if (scopes.length === 0 && !requestContext.has(MASTRA_SCOPES_KEY)) return requestContext;
  const derived = new RequestContext(Array.from(requestContext.entries()) as [string, unknown][]) as T;
  const downstream = withoutIdentityAgentScopes(scopes);
  if (downstream.length > 0) {
    setRunAgentScopes(derived, downstream, readOnly);
  } else {
    derived.delete(MASTRA_SCOPES_KEY);
    derived.delete(MASTRA_SCOPE_ACCESS_KEY);
  }
  return derived;
}

type ScopedRunOptions = {
  requestContext?: RequestContext<any>;
  memory?: { resource?: string; thread?: string | { id: string } };
};

/**
 * Returns the options a run executes with once its scopes are resolved. When scopes carry
 * `resource:`/`thread:`, `memory` is set from them so every downstream reader sees the same
 * identity. When the run has scopes, `requestContext` is the run-scoped copy from
 * `deriveAgentRunRequestContext`. Options for a run without scopes are returned unchanged.
 */
export function applyResolvedAgentScopes<T extends ScopedRunOptions>(
  options: T,
  resolved: ResolvedAgentScopes,
  requestContext: RequestContext<any>,
): T {
  const scopeResource = resolved.scopes.some(scope => parseAgentScope(scope)?.type === 'resource');
  const scopeThread = resolved.scopes.some(scope => parseAgentScope(scope)?.type === 'thread');
  let next = options;
  if (scopeResource || scopeThread) {
    const memory = options.memory;
    const memoryThreadId = typeof memory?.thread === 'string' ? memory.thread : memory?.thread?.id;
    next = {
      ...next,
      memory: {
        ...memory,
        resource: scopeResource ? resolved.resourceId : memory?.resource,
        thread: scopeThread && memoryThreadId !== resolved.threadId ? resolved.threadId : memory?.thread,
      },
    };
  }
  const runRequestContext = deriveAgentRunRequestContext(requestContext, resolved.scopes, resolved.readOnly);
  if (runRequestContext !== requestContext) {
    next = { ...next, requestContext: runRequestContext };
  }
  return next;
}
