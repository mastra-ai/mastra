import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_SCOPES_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '../request-context';

/**
 * Scope types Memory reads as the run's identity. Every other scope type is
 * arbitrary: Core passes it through without giving it meaning.
 */
const IDENTITY_SCOPE_TYPES = new Set(['resource', 'thread']);

const SCOPE_TYPE_PATTERN = /^[a-z][a-z0-9_-]*$/;

export type AgentScopesSnapshot = {
  resourceId?: string;
  threadId?: string;
  /** The full scope set the suspended run resolved, including identity scopes. */
  scopes?: readonly string[];
};

export type ResolveAgentScopesInput = {
  requestContext?: RequestContext;
  /** Scopes from the Agent config resolver and `defaultOptions.scopes`. */
  agentScopes?: readonly string[];
  /** Scopes passed on the call. */
  callScopes?: readonly string[];
  memory?: { resource?: string; thread?: string | { id: string } };
  resourceId?: string;
  threadId?: string;
  snapshot?: AgentScopesSnapshot;
};

export type ResolvedAgentScopes = {
  /** The run's full scope set, identity scopes included. */
  scopes: string[];
  resourceId?: string;
  threadId?: string;
};

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

function validateScopes(source: string, scopes: unknown): string[] {
  if (scopes === undefined || scopes === null) return [];
  if (!Array.isArray(scopes)) {
    throw scopesError('AGENT_SCOPES_INVALID', `Agent ${source} must be an array of "<type>:<value>" strings.`);
  }
  for (const scope of scopes) {
    if (typeof scope !== 'string') {
      throw scopesError('AGENT_SCOPES_INVALID', `Agent ${source} must contain only "<type>:<value>" strings.`);
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
  }
  return scopes as string[];
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
 * Scopes from the reserved `mastra__scopes` request-context key, the Agent's `scopes`
 * resolver, and the call's `scopes` are unioned. `resource:` and `thread:` scopes set the
 * run's Memory identity; every other source of resource/thread must agree with them or the
 * call throws. Resource and thread resolve independently: when scopes carry neither, the
 * existing precedence applies (reserved ID key, then options, then memory, then snapshot).
 *
 * On resume, the snapshot's scope set is authoritative. Re-supplied scopes may be any
 * subset of it; a scope the snapshot does not hold throws.
 */
export function resolveAgentScopes(input: ResolveAgentScopesInput): ResolvedAgentScopes {
  const { requestContext, memory, snapshot } = input;
  const supplied = new Set<string>([
    ...validateScopes(`request context "${MASTRA_SCOPES_KEY}"`, requestContext?.get(MASTRA_SCOPES_KEY)),
    ...validateScopes('config "scopes"', input.agentScopes),
    ...validateScopes('option "scopes"', input.callScopes),
  ]);

  let scopes: string[];
  if (snapshot?.scopes) {
    scopes = [...validateScopes('snapshot scopes', snapshot.scopes)];
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
  }

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

  return { scopes, resourceId: resourceId || undefined, threadId: threadId || undefined };
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
): T {
  if (scopes.length === 0 && !requestContext.has(MASTRA_SCOPES_KEY)) return requestContext;
  const derived = new RequestContext(Array.from(requestContext.entries()) as [string, unknown][]) as T;
  const downstream = withoutIdentityAgentScopes(scopes);
  if (downstream.length > 0) {
    derived.set(MASTRA_SCOPES_KEY, downstream);
  } else {
    derived.delete(MASTRA_SCOPES_KEY);
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
  const runRequestContext = deriveAgentRunRequestContext(requestContext, resolved.scopes);
  if (runRequestContext !== requestContext) {
    next = { ...next, requestContext: runRequestContext };
  }
  return next;
}
