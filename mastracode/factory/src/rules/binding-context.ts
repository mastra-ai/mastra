import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';

import { getFactoryAuthOrgId, getFactoryAuthUserFromContext } from '../auth.js';
import { REVIEW_CONTEXT } from '../boards/define-board.js';
import type {
  Card,
  FactoryRunBindingAddress,
  FactoryRunBindingRecord,
  FactoryRunBindingSessionAddress,
  WorkItemsStorage,
} from '../storage/domains/work-items/base.js';

interface FactorySessionState {
  factoryProjectId?: string;
  factoryOrgId?: string;
  projectRepositoryId?: string;
  untrustedCheckout?: boolean;
  baseRef?: string;
}

type FactorySessionControllerContext = AgentControllerRequestContext<FactorySessionState>;

/** Minimal source-control session lookup used to heal recovered session state. */
export interface FactorySessionSourceLookup {
  getBySessionId(
    sessionId: string,
  ): Promise<{ orgId: string; projectRepositoryId: string | null; baseBranch: string } | null>;
}

export function getFactorySessionCoordinates(
  requestContext: RequestContext | undefined,
): FactoryRunBindingSessionAddress | null {
  if (!requestContext || typeof requestContext.get !== 'function') return null;
  const context = requestContext.get('controller') as FactorySessionControllerContext | undefined;
  const factoryProjectId = context?.getState().factoryProjectId;
  if (!context?.threadId || !context.resourceId || !context.sessionId || !factoryProjectId) return null;
  return {
    factoryProjectId,
    threadId: context.threadId,
    resourceId: context.resourceId,
    sessionId: context.sessionId,
  };
}

export function getFactorySessionAddress(requestContext: RequestContext | undefined): FactoryRunBindingAddress | null {
  const coordinates = getFactorySessionCoordinates(requestContext);
  if (!coordinates || !requestContext || typeof requestContext.get !== 'function') return null;
  const user = getFactoryAuthUserFromContext(requestContext);
  const orgId = getFactoryAuthOrgId(user);
  if (!orgId) return null;
  return { orgId, ...coordinates };
}

/**
 * Read the session's factory scoping off controller state: the project whose
 * shared settings row applies to its runs, plus the org rung that row is keyed
 * by (`factoryOrgId` is seeded at session start and is authoritative for
 * downstream identity reads — the owner id is a user, never an org).
 */
export function readFactorySessionScope(
  requestContext: RequestContext | undefined,
): { factoryProjectId: string; factoryOrgId?: string } | null {
  if (!requestContext || typeof requestContext.get !== 'function') return null;
  const context = requestContext.get('controller') as FactorySessionControllerContext | undefined;
  const state = context?.getState();
  const factoryProjectId = state?.factoryProjectId;
  if (typeof factoryProjectId !== 'string' || factoryProjectId.length === 0) return null;
  const factoryOrgId = state?.factoryOrgId;
  return {
    factoryProjectId,
    ...(typeof factoryOrgId === 'string' && factoryOrgId.length > 0 ? { factoryOrgId } : {}),
  };
}

/**
 * Read the active run binding for this session when controller state has lost
 * `factoryProjectId` — a crash-recovered session ("Continue") is recreated with
 * empty state, so the binding table is the only remaining source of the project
 * whose shared settings row applies to the run. Read-only, unlike
 * `resolveFactorySessionAddress`: it neither heals state nor touches source
 * control, so input processors can call it before any tool has run.
 */
export async function findSessionRunBinding(
  requestContext: RequestContext | undefined,
  storage: Pick<WorkItemsStorage, 'findActiveRunBindingByThread'>,
): Promise<FactoryRunBindingRecord | null> {
  if (!requestContext || typeof requestContext.get !== 'function') return null;
  const context = requestContext.get('controller') as FactorySessionControllerContext | undefined;
  if (!context?.threadId || !context.resourceId || !context.sessionId) return null;
  const orgId = getFactoryAuthOrgId(getFactoryAuthUserFromContext(requestContext));
  if (!orgId) return null;
  return storage.findActiveRunBindingByThread({
    orgId,
    threadId: context.threadId,
    resourceId: context.resourceId,
    sessionId: context.sessionId,
  });
}

export interface FactorySessionAddressResolution {
  address: FactoryRunBindingAddress;
  /** Present only when the address was recovered from the binding table. */
  binding?: FactoryRunBindingRecord;
}

/**
 * Resolve the bound session address, falling back to the active binding row
 * when the in-memory session state is missing `factoryProjectId` — a server
 * crash drops controller sessions, and a resumed session ("Continue") is
 * recreated with empty state, which silently unregistered the transition
 * tool. On recovery the lost state is healed back onto the session (including
 * the `untrustedCheckout`/`baseRef` security posture the start coordinator
 * originally seeded) so later reads resolve directly.
 */
export async function resolveFactorySessionAddress(options: {
  requestContext: RequestContext | undefined;
  storage: Pick<WorkItemsStorage, 'findActiveRunBindingByThread' | 'get'>;
  sessions?: FactorySessionSourceLookup;
  /**
   * Resolve through the binding table even when state already carries
   * `factoryProjectId`, so the row heals the rest of the session state. Prompt
   * creation uses this: a partially persisted state can keep the project id
   * while the untrusted-checkout posture is gone, and the direct short-circuit
   * would take that id as proof the session is intact.
   */
  forceBindingLookup?: boolean;
}): Promise<FactorySessionAddressResolution | null> {
  const direct = options.forceBindingLookup ? null : getFactorySessionAddress(options.requestContext);
  if (direct) return { address: direct };

  const requestContext = options.requestContext;
  if (!requestContext || typeof requestContext.get !== 'function') return null;
  const context = requestContext.get('controller') as FactorySessionControllerContext | undefined;
  if (!context?.threadId || !context.resourceId || !context.sessionId) return null;
  const user = getFactoryAuthUserFromContext(requestContext);
  const orgId = getFactoryAuthOrgId(user);
  if (!orgId) return null;

  const binding = await options.storage.findActiveRunBindingByThread({
    orgId,
    threadId: context.threadId,
    resourceId: context.resourceId,
    sessionId: context.sessionId,
  });
  if (!binding) return null;

  await healRecoveredSessionState({ context, binding, storage: options.storage, sessions: options.sessions });

  return {
    address: {
      orgId,
      factoryProjectId: binding.factoryProjectId,
      threadId: context.threadId,
      resourceId: context.resourceId,
      sessionId: context.sessionId,
    },
    binding,
  };
}

// A review role decides from the row alone, so no failed work item lookup can lose the verdict.
function isUntrustedRun(binding: FactoryRunBindingRecord, item?: Card | null): boolean {
  return binding.role === REVIEW_CONTEXT || item?.externalSource?.type === 'pull-request';
}

function trustedBaseRef(sourceSession: { baseBranch: string } | null, item: Card | null | undefined) {
  const metadataBaseBranch = item?.workItem.metadata?.baseBranch;
  return (
    sourceSession?.baseBranch ||
    (typeof metadataBaseBranch === 'string' && metadataBaseBranch ? metadataBaseBranch : undefined)
  );
}

async function healRecoveredSessionState(options: {
  context: FactorySessionControllerContext;
  binding: FactoryRunBindingRecord;
  storage: Pick<WorkItemsStorage, 'get'>;
  sessions?: FactorySessionSourceLookup;
}): Promise<void> {
  const { binding } = options;
  // `factoryOrgId` mirrors the start coordinator's seed: the binding row holds
  // the authoritative org id, so crash-recovered sessions heal it for free.
  const updates: FactorySessionState = { factoryProjectId: binding.factoryProjectId, factoryOrgId: binding.orgId };
  if (isUntrustedRun(binding)) updates.untrustedCheckout = true;
  try {
    const item = await options.storage.get({ orgId: binding.orgId, id: binding.workItemId });
    const foundSession = (await options.sessions?.getBySessionId(binding.sessionId)) ?? null;
    const sourceSession = foundSession?.orgId === binding.orgId ? foundSession : null;
    if (sourceSession?.projectRepositoryId) {
      updates.projectRepositoryId = sourceSession.projectRepositoryId;
    }
    if (isUntrustedRun(binding, item)) {
      updates.untrustedCheckout = true;
      const baseRef = trustedBaseRef(sourceSession, item);
      if (baseRef) updates.baseRef = baseRef;
    } else {
      // Record the trusted verdict explicitly so a healed session carries every
      // trust field; the prompt-time recovery check treats a missing flag as
      // "not yet verified" and would otherwise re-run on every prompt. Left
      // unset when enrichment fails so the next prompt retries the lookup.
      updates.untrustedCheckout = false;
    }
  } catch {
    // Enrichment is best-effort; the address itself only needs the binding.
  }
  try {
    await options.context.setState(updates);
  } catch {
    // State healing must never block tool registration on the recovered address.
  }
}

export async function restorePromptCheckoutTrust(options: {
  requestContext: RequestContext;
  storage: Pick<WorkItemsStorage, 'findActiveRunBindingByThread' | 'listRunBindingsForSession' | 'get'>;
  sessions?: FactorySessionSourceLookup;
}): Promise<void> {
  const context = options.requestContext.get('controller') as FactorySessionControllerContext | undefined;
  if (!context?.threadId || !context.sessionId) return;
  const current = context.getState();
  if (current.factoryProjectId && current.factoryOrgId && typeof current.untrustedCheckout === 'boolean') return;
  const binding = (await resolveFactorySessionAddress({ ...options, forceBindingLookup: true }))?.binding;
  // History is read even with an active binding: an earlier pull request run, or a card that
  // can no longer be read, keeps the checkout untrusted whatever the active role is.
  const untrusted =
    (binding !== undefined && isUntrustedRun(binding)) || (await restoreHistoricalCheckoutPosture(context, options));
  const state = context.getState();
  if ((binding && state.factoryProjectId !== binding.factoryProjectId) || (untrusted && !state.untrustedCheckout)) {
    throw new Error('Factory review session security state could not be restored before prompt creation.');
  }
}

// Keyed by session, not thread or resource: the checkout outlives both. Never restores authority.
async function restoreHistoricalCheckoutPosture(
  context: FactorySessionControllerContext,
  options: {
    requestContext: RequestContext;
    storage: Pick<WorkItemsStorage, 'listRunBindingsForSession' | 'get'>;
    sessions?: FactorySessionSourceLookup;
  },
): Promise<boolean> {
  const orgId = getFactoryAuthOrgId(getFactoryAuthUserFromContext(options.requestContext));
  if (!orgId) return false;
  const bindings = await options.storage.listRunBindingsForSession({ orgId, sessionId: context.sessionId });
  if (bindings.length === 0) return false;
  const workItemIds = [...new Set(bindings.map(binding => binding.workItemId))];
  const items = new Map(
    await Promise.all(
      workItemIds.map(async id => [id, await options.storage.get({ orgId, id }).catch(() => undefined)] as const),
    ),
  );
  const unverifiable =
    new Set(bindings.map(binding => binding.factoryProjectId)).size > 1 ||
    bindings.some(binding => !isUntrustedRun(binding) && !items.get(binding.workItemId));
  if (unverifiable) {
    await context.setState({ untrustedCheckout: true });
    return true;
  }
  const latest = bindings.findLast(binding => isUntrustedRun(binding, items.get(binding.workItemId)));
  if (!latest) return false;
  const foundSession = await options.sessions?.getBySessionId(context.sessionId).catch(() => null);
  const baseRef = trustedBaseRef(foundSession?.orgId === orgId ? foundSession : null, items.get(latest.workItemId));
  await context.setState({ untrustedCheckout: true, ...(baseRef ? { baseRef } : {}) });
  return true;
}
