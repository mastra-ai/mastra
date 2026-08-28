import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';

import { getFactoryAuthOrgId, getFactoryAuthUserFromContext } from '../auth.js';
import type {
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
  getBySessionId(sessionId: string): Promise<{ orgId: string; projectRepositoryId: string; baseBranch: string } | null>;
}

export function getFactorySessionCoordinates(
  requestContext: RequestContext | undefined,
): FactoryRunBindingSessionAddress | null {
  if (!requestContext || typeof requestContext.get !== 'function') return null;
  const context = requestContext.get('controller') as FactorySessionControllerContext | undefined;
  const factoryProjectId = context?.getState().factoryProjectId;
  if (!context?.threadId || !context.resourceId || !factoryProjectId) return null;
  return {
    factoryProjectId,
    threadId: context.threadId,
    resourceId: context.resourceId,
    sessionId: context.resourceId,
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
}): Promise<FactorySessionAddressResolution | null> {
  const direct = getFactorySessionAddress(options.requestContext);
  if (direct) return { address: direct };

  const requestContext = options.requestContext;
  if (!requestContext || typeof requestContext.get !== 'function') return null;
  const context = requestContext.get('controller') as FactorySessionControllerContext | undefined;
  if (!context?.threadId || !context.resourceId) return null;
  const user = getFactoryAuthUserFromContext(requestContext);
  const orgId = getFactoryAuthOrgId(user);
  if (!orgId) return null;

  const binding = await options.storage.findActiveRunBindingByThread({
    orgId,
    threadId: context.threadId,
    resourceId: context.resourceId,
    sessionId: context.resourceId,
  });
  if (!binding) return null;

  await healRecoveredSessionState({ context, binding, storage: options.storage, sessions: options.sessions });

  return {
    address: {
      orgId,
      factoryProjectId: binding.factoryProjectId,
      threadId: context.threadId,
      resourceId: context.resourceId,
      sessionId: context.resourceId,
    },
    binding,
  };
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
  // Security posture first, from the binding row alone (no I/O): review-bound
  // sessions run against attacker-writable checkouts, so `untrustedCheckout`
  // must survive even if the enrichment lookups below fail transiently.
  if (binding.role === 'review') {
    updates.untrustedCheckout = true;
  }
  // Best-effort enrichment mirroring the start coordinator's original seed:
  // PR-sourced work items are untrusted regardless of role, and `baseRef`
  // restores the trusted instruction source for untrusted checkouts.
  try {
    const item = await options.storage.get({ orgId: binding.orgId, id: binding.workItemId });
    const foundSession = (await options.sessions?.getBySessionId(binding.sessionId)) ?? null;
    const sourceSession = foundSession?.orgId === binding.orgId ? foundSession : null;
    if (sourceSession) {
      updates.projectRepositoryId = sourceSession.projectRepositoryId;
    }
    const untrusted = updates.untrustedCheckout === true || item?.externalSource?.type === 'pull-request';
    if (untrusted) {
      updates.untrustedCheckout = true;
      const metadataBaseBranch = item?.metadata?.baseBranch;
      const baseRef =
        sourceSession?.baseBranch ||
        (typeof metadataBaseBranch === 'string' && metadataBaseBranch ? metadataBaseBranch : undefined);
      if (baseRef) updates.baseRef = baseRef;
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
