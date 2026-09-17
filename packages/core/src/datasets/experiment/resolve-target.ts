import type { Agent } from '../../agent';
import {
  exactVersionOverridesForPins,
  getAgentVersionPins,
  getResolvedAgentVersionSelection,
  reconcileRootVersionOverrides,
  recordAgentVersionPin,
} from '../../agent/version-pins';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import type { Mastra } from '../../mastra';
import type { VersionOverrides, VersionSelector } from '../../mastra/types';
import { RequestContext } from '../../request-context';
import type { Target } from './executor';

/**
 * Resolve a target from Mastra's registries by type and ID.
 * When `agentVersion` is provided for an agent target, the returned agent
 * will have the versioned config applied (via `applyStoredOverrides`).
 *
 * The result is wrapped in `{ target }` because `Workflow` has a `.then`
 * method for step chaining, which makes it thenable. Returning a thenable
 * from an async function causes the Promise machinery to attempt to unwrap
 * it, which hangs forever since the builder `.then` never invokes its
 * callbacks. Wrapping in a plain object avoids the unwrap.
 */
export async function resolveTarget(
  mastra: Mastra,
  targetType: string,
  targetId: string,
  agentVersion?: string,
): Promise<{ target: Target } | null> {
  let resolved: Target | null = null;

  switch (targetType) {
    case 'agent':
      try {
        if (agentVersion) {
          resolved = await mastra.getAgentById(targetId, { versionId: agentVersion });
        } else {
          resolved = mastra.getAgentById(targetId);
        }
      } catch {
        // Try by name if ID lookup fails
        try {
          if (agentVersion) {
            resolved = await mastra.getAgent(targetId, { versionId: agentVersion });
          } else {
            resolved = mastra.getAgent(targetId);
          }
        } catch {
          // leave null
        }
      }
      break;
    case 'workflow':
      try {
        resolved = mastra.getWorkflowById(targetId);
      } catch {
        // Try by name if ID lookup fails
        try {
          resolved = mastra.getWorkflow(targetId);
        } catch {
          // leave null
        }
      }
      break;
    case 'scorer':
      try {
        resolved = mastra.getScorerById(targetId) ?? null;
      } catch {
        // leave null
      }
      break;
    case 'processor':
      // Processors not yet in registry - Phase 4
      break;
    default:
      break;
  }

  return resolved ? { target: resolved } : null;
}

function sameSelector(left: VersionSelector, right: VersionSelector): boolean {
  if ('versionId' in left) return 'versionId' in right && left.versionId === right.versionId;
  if ('label' in left) return 'label' in right && left.label === right.label;
  return 'status' in right && left.status === right.status;
}

function missingImmutableSelection(agentId: string, selector: VersionSelector): never {
  throw new MastraError({
    id: 'PINNED_VERSION_REQUIRED',
    domain: ErrorDomain.AGENT,
    category: ErrorCategory.USER,
    text: `Experiment could not freeze the version selector for agent "${agentId}" to an immutable version ID.`,
    details: {
      agentId,
      ...('label' in selector ? { requestedLabel: selector.label } : {}),
      ...('status' in selector ? { requestedStatus: selector.status } : {}),
    },
  });
}

/**
 * Resolve an experiment target and freeze its explicit agent selectors before
 * the first item starts. An experiment can execute the target many times (one
 * per item and again for retries), so forwarding a movable label to each call
 * would make one experiment span multiple immutable agent versions.
 *
 * Root selectors use the canonical `versions.self` spelling internally. The
 * legacy `agentVersion` field remains an exact-version alias. Reachable explicit
 * dependency selectors are resolved by the Agent's normal recursive resolver;
 * label selectors that are not known from the selected root fail closed rather
 * than leaking into the item loop for later re-resolution.
 *
 * @internal
 */
export async function resolveExperimentTarget(
  mastra: Mastra,
  targetType: string,
  targetId: string,
  options?: {
    agentVersion?: string;
    versions?: VersionOverrides;
    requestContext?: Record<string, unknown>;
  },
): Promise<{ target: Target; versions?: VersionOverrides } | null> {
  const base = await resolveTarget(mastra, targetType, targetId);
  if (!base || targetType !== 'agent') return base;

  const baseAgent = base.target as Agent;
  const canonicalVersions = reconcileRootVersionOverrides(options?.versions, baseAgent.id);
  const canonicalRootSelector = canonicalVersions?.self;
  const legacyRootSelector = options?.agentVersion ? ({ versionId: options.agentVersion } as const) : undefined;

  if (canonicalRootSelector && legacyRootSelector && !sameSelector(canonicalRootSelector, legacyRootSelector)) {
    throw new MastraError({
      id: 'INVALID_VERSION_SELECTOR',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      text: `Experiment target "${baseAgent.id}" received conflicting root version selectors.`,
      details: {
        agentId: baseAgent.id,
        agentVersion: legacyRootSelector.versionId,
        versionsSelf: JSON.stringify(canonicalRootSelector),
      },
    });
  }

  const rootSelector = canonicalRootSelector ?? legacyRootSelector;
  let resolvedAgent = baseAgent;
  if (rootSelector) {
    if (canonicalRootSelector) {
      resolvedAgent = await mastra.resolveVersionedAgent(baseAgent, rootSelector);
    } else {
      // Keep the pre-existing agentVersion lookup behavior (including ID/name
      // fallback) while folding its exact identity into the frozen map below.
      const legacyResolved = await resolveTarget(mastra, targetType, targetId, options?.agentVersion);
      if (!legacyResolved) return null;
      resolvedAgent = legacyResolved.target as Agent;
    }
  }

  const resolutionContext: RequestContext = new RequestContext<unknown>(Object.entries(options?.requestContext ?? {}));
  if (rootSelector) {
    const resolvedRootSelection =
      (typeof (resolvedAgent as Agent).toRawConfig === 'function'
        ? getResolvedAgentVersionSelection(resolvedAgent, rootSelector)
        : undefined) ??
      (typeof rootSelector.versionId === 'string'
        ? { agentId: baseAgent.id, versionId: rootSelector.versionId }
        : missingImmutableSelection(baseAgent.id, rootSelector));
    recordAgentVersionPin(resolutionContext, resolvedRootSelection, 'root');
  }

  if (typeof resolvedAgent.__resolveExplicitAgentVersionPins === 'function') {
    await resolvedAgent.__resolveExplicitAgentVersionPins({
      requestContext: resolutionContext,
      versions: canonicalVersions,
    });
  }

  const pins = getAgentVersionPins(resolutionContext);
  const pinnedOverrides = exactVersionOverridesForPins(pins, canonicalVersions?.defaultStatus);
  const frozenAgents: NonNullable<VersionOverrides['agents']> = {
    ...(pinnedOverrides?.agents ?? {}),
  };

  // Exact IDs are already immutable and remain valid even when the dependency
  // is supplied dynamically at item execution time. Status preserves its
  // established fallback behavior. A label, however, must have produced a pin
  // during the recursive run-start audit or the experiment cannot start safely.
  for (const [agentId, selector] of Object.entries(canonicalVersions?.agents ?? {})) {
    if (frozenAgents[agentId]) continue;
    if ('label' in selector) missingImmutableSelection(agentId, selector);
    frozenAgents[agentId] = selector;
  }

  const frozenVersions: VersionOverrides = {
    ...(pinnedOverrides?.self ? { self: pinnedOverrides.self } : {}),
    ...(Object.keys(frozenAgents).length > 0 ? { agents: frozenAgents } : {}),
    ...(canonicalVersions?.defaultStatus ? { defaultStatus: canonicalVersions.defaultStatus } : {}),
  };

  return {
    target: resolvedAgent,
    ...(Object.keys(frozenVersions).length > 0 ? { versions: frozenVersions } : {}),
  };
}
