import type { Agent } from '@mastra/core/agent';

/**
 * Resolve the workspace id to attach the agent to.
 *
 * A workspace id is an opaque identifier, not free text to generate, so this is
 * a deterministic normalization (trim + drop empties). The injected `agent` is
 * accepted for signature consistency with the other handlers and for future use
 * (e.g. disambiguating a workspace by name).
 *
 * Infra-agnostic: receives a ready-to-use `Agent` (dependency-injected by the
 * step) and explicit domain args, never a workflow `ctx`.
 */
export async function resolveWorkspaceId(agent: Agent, workspaceId?: string): Promise<string | undefined> {
  void agent;
  const trimmed = workspaceId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}
