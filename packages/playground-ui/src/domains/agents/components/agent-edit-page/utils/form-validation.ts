import { z } from 'zod';
import type { JsonSchema } from '@/lib/json-schema';

const scoringSamplingConfigSchema = z.object({
  type: z.enum(['ratio', 'count']),
  rate: z.number().optional(),
  count: z.number().optional(),
});

const entityConfigSchema = z.object({
  description: z.string().max(500).optional(),
});

const scorerConfigSchema = z.object({
  description: z.string().max(500).optional(),
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
  tools: z.record(z.string(), entityConfigSchema).optional(),
  workflows: z.record(z.string(), entityConfigSchema).optional(),
  agents: z.record(z.string(), entityConfigSchema).optional(),
  scorers: z.record(z.string(), scorerConfigSchema).optional(),
  variables: z.custom<JsonSchema>().optional(),
});

export type AgentFormValues = z.infer<typeof agentFormSchema>;
