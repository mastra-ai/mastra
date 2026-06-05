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

export const idNameEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const availableAgentToolSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['tool', 'agent', 'workflow']),
});

export const inputSchema = z.object({
  description: z.string().min(1).describe('Plain-language description of the agent to build'),
  name: z.string().optional().describe('Optional explicit agent name; otherwise derived from the description'),
  instructions: z.string().optional().describe('Optional explicit system prompt; otherwise generated'),
  workspaceId: z.string().optional().describe('Optional workspace id to attach the agent to'),
  tools: z.array(idNameEntrySchema).optional().describe('Tools/agents/workflows to enable, each as { id, name }'),
  availableAgentTools: z
    .array(availableAgentToolSchema)
    .optional()
    .describe('Available tools/agents/workflows used to classify the selected tool entries by type'),
  skills: z.array(idNameEntrySchema).optional().describe('Stored skills to attach, each as { id, name }'),
  model: modelSchema.optional().describe('Model to use, as { provider, name }'),
  availableModels: z
    .array(modelSchema)
    .optional()
    .describe('Available models the agent can choose from when no explicit model is supplied'),
  browserEnabled: z.boolean().optional().describe('Whether to enable browser access for the agent'),
});

// Accumulating config-in-progress threaded from step to step.
export const configSchema = z.object({
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
