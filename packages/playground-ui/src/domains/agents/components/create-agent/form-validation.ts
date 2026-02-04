import { z } from 'zod';
import type { Provider } from '@mastra/client-js';
import { cleanProviderId } from '../agent-metadata/utils';

const scoringSamplingConfigSchema = z.union([
  z.object({
    type: z.literal('none'),
  }),
  z.object({
    type: z.literal('ratio'),
    rate: z.number(),
  }),
]);

const scorerConfigSchema = z.object({
  sampling: scoringSamplingConfigSchema.optional(),
});

export const agentFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  instructions: z.string().min(1, 'Instructions are required'),
  model: z.object({
    provider: z.string().min(1, 'Provider is required'),
    name: z.string().min(1, 'Model is required'),
  }),
  tools: z.array(z.string()).optional(),
  workflows: z.array(z.string()).optional(),
  agents: z.array(z.string()).optional(),
  memory: z
    .object({
      vector: z.union([z.string(), z.literal(false)]).optional(),
      options: z
        .object({
          readOnly: z.boolean().optional(),
          lastMessages: z.union([z.number(), z.literal(false)]).optional(),
          semanticRecall: z
            .union([
              z.boolean(),
              z.object({
                topK: z.number(),
                messageRange: z.union([z.number(), z.object({ before: z.number(), after: z.number() })]),
                scope: z.enum(['thread', 'resource']).optional(),
                threshold: z.number().optional(),
                indexName: z.string().optional(),
              }),
            ])
            .optional(),
          generateTitle: z
            .union([
              z.boolean(),
              z.object({
                model: z.string(),
                instructions: z.string().optional(),
              }),
            ])
            .optional(),
        })
        .optional(),
      embedder: z.string().optional(),
      embedderOptions: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  scorers: z.record(z.string(), scorerConfigSchema).optional(),
});

export type AgentFormValues = z.infer<typeof agentFormSchema>;

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

export function validateReferences(
  values: AgentFormValues,
  availableTools: string[],
  availableWorkflows: string[],
  availableAgents: string[],
): ValidationResult {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  // Check tools exist
  const invalidTools = values.tools?.filter(t => !availableTools.includes(t)) || [];
  if (invalidTools.length > 0) {
    errors.tools = `Unknown tools: ${invalidTools.join(', ')}`;
  }

  // Check workflows exist
  const invalidWorkflows = values.workflows?.filter(w => !availableWorkflows.includes(w)) || [];
  if (invalidWorkflows.length > 0) {
    errors.workflows = `Unknown workflows: ${invalidWorkflows.join(', ')}`;
  }

  // Check agents exist
  const invalidAgents = values.agents?.filter(a => !availableAgents.includes(a)) || [];
  if (invalidAgents.length > 0) {
    errors.agents = `Unknown agents: ${invalidAgents.join(', ')}`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings,
  };
}

export function isProviderConnected(provider: string, providers: Provider[]): boolean {
  const cleanedProvider = cleanProviderId(provider);
  const found = providers.find(p => cleanProviderId(p.id) === cleanedProvider);
  return found?.connected ?? false;
}

export function getProviderWarning(provider: string, providers: Provider[]): string | null {
  const cleanedProvider = cleanProviderId(provider);
  const found = providers.find(p => cleanProviderId(p.id) === cleanedProvider);
  if (found && !found.connected) {
    const envVar = Array.isArray(found.envVar) ? found.envVar.join(', ') : found.envVar;
    return `Provider "${found.name}" is not connected. Set ${envVar} to use this provider.`;
  }
  return null;
}
