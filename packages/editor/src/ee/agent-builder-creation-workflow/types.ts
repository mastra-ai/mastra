import { z } from 'zod-v4';

/**
 * Shared schemas and types for the agent-builder creation workflow.
 *
 * `inputSchema` is the workflow entry shape. `configSchema` is the
 * config-in-progress accumulated and threaded from step to step. `outputSchema`
 * is the final, fully-resolved agent configuration. They mirror
 * `AgentBuilderEditFormValues` for the fields the playground agent-builder
 * client tools can set (`visibility` and `avatarUrl` are intentionally omitted —
 * no client tool sets those).
 */

export const modelSchema = z.object({
  provider: z.string(),
  name: z.string(),
});

/**
 * Structured, LLM-understandable interpretation of the raw user prompt produced
 * by the first workflow step (`understand-user-outcome`). Downstream steps read
 * this instead of re-interpreting the prompt, so the agent name, description and
 * instructions are anchored to what the user actually wants to achieve.
 */
export const userOutcomeSchema = z.object({
  goal: z.string().min(1).describe('The single outcome the user wants the agent to achieve, in plain language'),
  audience: z.string().describe('Who will use or benefit from the agent (the target users)'),
  capabilities: z.array(z.string()).describe('The concrete capabilities the agent needs to deliver the goal'),
  tone: z.string().describe('The tone/persona the agent should adopt when interacting'),
  successCriteria: z.array(z.string()).describe('Observable signals that the agent has succeeded at the goal'),
});

export const inputSchema = z.object({
  prompt: z.string().min(1).describe('Plain-language prompt describing the agent to build'),
});

// Accumulating config-in-progress threaded from step to step.
export const configSchema = z.object({
  userOutcome: userOutcomeSchema,
  name: z.string().optional(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  workspaceId: z.string().optional(),
  tools: z.record(z.string(), z.boolean()).optional(),
  agents: z.record(z.string(), z.boolean()).optional(),
  workflows: z.record(z.string(), z.boolean()).optional(),
  skills: z.record(z.string(), z.boolean()).optional(),
  model: modelSchema.optional(),
  browserEnabled: z.boolean().optional(),
});

export const outputSchema = z.object({
  name: z.string(),
  description: z.string(),
  instructions: z.string(),
  workspaceId: z.string().optional(),
  tools: z.record(z.string(), z.boolean()).optional(),
  agents: z.record(z.string(), z.boolean()).optional(),
  workflows: z.record(z.string(), z.boolean()).optional(),
  skills: z.record(z.string(), z.boolean()).optional(),
  model: modelSchema.optional(),
  browserEnabled: z.boolean().optional(),
});

export type WorkflowInput = z.infer<typeof inputSchema>;
export type Config = z.infer<typeof configSchema>;
export type UserOutcome = z.infer<typeof userOutcomeSchema>;

/** Arguments every step factory receives — currently just the builder model. */
export interface StepFactoryArgs {
  model: string;
}

/** Arguments every per-step agent factory receives — the builder model string. */
export interface AgentFactoryArgs {
  /** The model the builder runs on, resolved by each step agent. */
  model: string;
}

/**
 * Plain domain types shared by the per-step handlers.
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
