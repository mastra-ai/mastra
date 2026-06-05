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

/**
 * Which agent-builder capabilities are enabled for the running builder. Resolved
 * deterministically from the builder feature flags by the `feature-capability`
 * step. Mirrors the playground's `useBuilderAgentFeatures`: each flag is the raw
 * `features.agent.{key} === true` value (an omitted flag resolves to `false`).
 */
export const featureCapabilitiesSchema = z.object({
  tools: z.boolean().default(false),
  agents: z.boolean().default(false),
  workflows: z.boolean().default(false),
  scorers: z.boolean().default(false),
  skills: z.boolean().default(false),
  memory: z.boolean().default(false),
  variables: z.boolean().default(false),
  favorites: z.boolean().default(false),
  avatarUpload: z.boolean().default(false),
  browser: z.boolean().default(false),
  model: z.boolean().default(false),
});

// Accumulating config-in-progress threaded from step to step.
export const configSchema = z.object({
  userOutcome: userOutcomeSchema,
  featureCapabilities: featureCapabilitiesSchema.optional(),
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

/**
 * Final workflow output: the persisted agent. The terminal `persist-agent` step
 * maps the accumulated config onto a `StorageCreateAgentInput`, calls
 * `editor.agent.create(...)`, and returns the created agent's `id` plus the
 * resolved config it was created from (so callers can inspect what was stored
 * without re-reading it).
 */
export const createResultSchema = z.object({
  id: z.string(),
  visibility: z.enum(['private', 'public']),
  config: outputSchema,
});

export type WorkflowInput = z.infer<typeof inputSchema>;
export type Config = z.infer<typeof configSchema>;
export type CreateResult = z.infer<typeof createResultSchema>;
export type UserOutcome = z.infer<typeof userOutcomeSchema>;
export type FeatureCapabilities = z.infer<typeof featureCapabilitiesSchema>;

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
