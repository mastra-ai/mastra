import type { Agent } from '../../agent';
import type { MastraModelConfig } from '../../llm/model/shared.types';
import type { Mastra } from '../../mastra';
import type { Target } from './executor';

/**
 * Resolve a target from Mastra's registries by type and ID.
 * When `agentVersion` is provided for an agent target, the returned agent
 * will have the versioned config applied (via `applyStoredOverrides`).
 *
 * When `model` is provided for an agent target, the override is applied to a
 * private copy of the agent (same id) so the registered singleton is never
 * mutated. A versioned agent is already a private fork, so the override is
 * applied on it directly — re-forking would drop the "stored version applied"
 * marker and let execution re-resolve the version, discarding the override.
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
  model?: MastraModelConfig,
): Promise<{ target: Target } | null> {
  if (model && targetType !== 'agent') {
    throw new Error(`Experiment "model" override is only supported for agent targets (got "${targetType}")`);
  }

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
      if (model && resolved) {
        const agent = agentVersion ? (resolved as Agent) : (resolved as Agent).__fork();
        agent.__updateModel({ model });
        resolved = agent;
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
