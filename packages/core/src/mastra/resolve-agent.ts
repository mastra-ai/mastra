import type { Agent } from '../agent';
import type { Mastra } from '.';

/**
 * Outcome of a registry-then-editor agent lookup.
 *
 * - `found` — the agent was resolved (from either source).
 * - `missing` — neither the registry nor the editor knows the agent. This is
 *   a *confirmed* miss: callers may safely treat the agent as gone (e.g.
 *   reclaim schedule rows that target it).
 * - `error` — the registry missed and the editor lookup threw. This proves
 *   nothing about the agent's existence (transient storage failure,
 *   hydration error, editor initialization race), so callers MUST NOT take
 *   destructive action on it.
 */
export type ResolveAgentByIdResult =
  | { status: 'found'; agent: Agent }
  | { status: 'missing' }
  | { status: 'error'; error: unknown };

/**
 * Resolve an agent by id the same way server handlers do: in-memory registry
 * first, then the editor for stored agents.
 *
 * Stored (editor) agents aren't registered on the Mastra instance until
 * they've been hydrated once in the current process, so a registry miss does
 * not mean the agent is gone — especially on a cold start. Editor hydration
 * via `getById` also re-registers the agent, so subsequent lookups take the
 * fast registry path.
 *
 * Every internal call site that needs "does this agent exist / give it to
 * me" semantics should go through this helper so the fallback (and the
 * confirmed-miss vs. transient-error distinction) can't drift between call
 * sites.
 */
export async function resolveAgentById(mastra: Mastra, agentId: string): Promise<ResolveAgentByIdResult> {
  try {
    return { status: 'found', agent: mastra.getAgentById(agentId) };
  } catch {
    // Registry miss — fall through to the editor.
  }

  const editor = mastra.getEditor?.();
  if (!editor) return { status: 'missing' };

  try {
    const agent = await editor.agent.getById(agentId);
    return agent ? { status: 'found', agent } : { status: 'missing' };
  } catch (error) {
    return { status: 'error', error };
  }
}
