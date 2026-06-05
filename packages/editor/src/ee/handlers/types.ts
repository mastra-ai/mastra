/**
 * Plain domain types shared by the agent-builder creation handlers.
 *
 * Handlers are infra-agnostic: they receive explicit domain arguments (never a
 * Mastra workflow `ctx`). These types describe those arguments and results.
 */

export type AgentToolType = 'tool' | 'agent' | 'workflow';

/** An available tool/agent/workflow the agent can be configured with. */
export interface AvailableAgentTool {
  id: string;
  name: string;
  type: AgentToolType;
}

/** A user-supplied `{ id, name }` selection entry. */
export interface IdNameEntry {
  id: string;
  name: string;
}

export interface AgentModel {
  provider: string;
  name: string;
}

/** Result of routing tool entries into the three form record keys. */
export interface RoutedTools {
  tools: Record<string, boolean>;
  agents: Record<string, boolean>;
  workflows: Record<string, boolean>;
}
