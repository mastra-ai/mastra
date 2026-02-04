import { z } from 'zod';
import type { JsonSchema } from '@/lib/json-schema';

const scoringSamplingConfigSchema = z.object({
  type: z.enum(['ratio']),
  rate: z.number().optional(),
});

const entityConfigSchema = z.object({
  description: z.string().max(500).optional(),
});

const scorerConfigSchema = z.object({
  description: z.string().max(500).optional(),
  sampling: scoringSamplingConfigSchema.optional(),
});

const memoryConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    lastMessages: z.union([z.number().min(1), z.literal(false)]).optional(),
    semanticRecall: z.boolean().optional(),
    readOnly: z.boolean().optional(),
    vector: z.string().optional(),
    embedder: z.string().optional(),
  })
  .refine(
    data => {
      // If semanticRecall is enabled, vector and embedder are required
      if (data.semanticRecall && data.enabled) {
        return !!data.vector && !!data.embedder;
      }
      return true;
    },
    {
      message: 'Semantic recall requires both vector and embedder to be configured',
      path: ['semanticRecall'],
    },
  );

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
  memory: memoryConfigSchema.optional(),
  variables: z.custom<JsonSchema>().optional(),
});

export type AgentFormValues = z.infer<typeof agentFormSchema>;
