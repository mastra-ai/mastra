import { z } from 'zod';
import { v4 as uuid } from '@lukeed/uuid';
import type { JsonSchema } from '@/lib/json-schema';
import type { RuleGroup, RuleGroupDepth1, RuleGroupDepth2 } from '@mastra/core/storage';

export type InMemoryFileNode = {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  children?: InMemoryFileNode[];
};

export type SkillFormValue = {
  localId: string;
  name: string;
  description: string;
  workspaceId: string;
  files: InMemoryFileNode[];
};

export type InstructionBlock = {
  id: string;
  type: 'prompt_block';
  content: string;
  rules?: RuleGroup;
};

const ruleSchema = z.object({
  field: z.string(),
  operator: z.enum([
    'equals',
    'not_equals',
    'contains',
    'not_contains',
    'greater_than',
    'less_than',
    'greater_than_or_equal',
    'less_than_or_equal',
    'in',
    'not_in',
    'exists',
    'not_exists',
  ]),
  value: z.unknown().optional(),
});

const ruleGroupDepth2Schema: z.ZodType<RuleGroupDepth2> = z.object({
  operator: z.enum(['AND', 'OR']),
  conditions: z.array(ruleSchema),
});

const ruleGroupDepth1Schema: z.ZodType<RuleGroupDepth1> = z.object({
  operator: z.enum(['AND', 'OR']),
  conditions: z.array(z.union([ruleSchema, ruleGroupDepth2Schema])),
});

const ruleGroupSchema: z.ZodType<RuleGroup> = z.object({
  operator: z.enum(['AND', 'OR']),
  conditions: z.array(z.union([ruleSchema, ruleGroupDepth1Schema])),
});

const instructionBlockSchema = z.object({
  id: z.string(),
  type: z.literal('prompt_block'),
  content: z.string(),
  rules: ruleGroupSchema.optional(),
});

export const createInstructionBlock = (content = '', rules?: RuleGroup): InstructionBlock => ({
  id: uuid(),
  type: 'prompt_block',
  content,
  rules,
});

const scoringSamplingConfigSchema = z.object({
  type: z.enum(['ratio']),
  rate: z.number().optional(),
});

const entityConfigSchema = z.object({
  description: z.string().max(500).optional(),
  rules: ruleGroupSchema.optional(),
});

const skillConfigSchema = z.object({
  description: z.string().optional(),
  instructions: z.string().optional(),
  pin: z.string().optional(),
  strategy: z.enum(['latest', 'live']).optional(),
});

const scorerConfigSchema = z.object({
  description: z.string().max(500).optional(),
  sampling: scoringSamplingConfigSchema.optional(),
  rules: ruleGroupSchema.optional(),
});

const memoryConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    lastMessages: z.union([z.number().min(1), z.literal(false)]).optional(),
    semanticRecall: z.boolean().optional(),
    readOnly: z.boolean().optional(),
    vector: z.string().optional(),
    embedder: z.string().optional(),
    observationalMemory: z
      .object({
        enabled: z.boolean().optional(),
        model: z
          .object({
            provider: z.string().optional(),
            name: z.string().optional(),
          })
          .optional(),
        scope: z.enum(['resource', 'thread']).optional(),
        shareTokenBudget: z.boolean().optional(),
        observation: z
          .object({
            model: z
              .object({
                provider: z.string().optional(),
                name: z.string().optional(),
              })
              .optional(),
            messageTokens: z.number().min(1).optional(),
            maxTokensPerBatch: z.number().min(1).optional(),
            bufferTokens: z.union([z.number().min(0), z.literal(false)]).optional(),
            bufferActivation: z.number().min(0).max(1).optional(),
            blockAfter: z.number().min(0).optional(),
          })
          .optional(),
        reflection: z
          .object({
            model: z
              .object({
                provider: z.string().optional(),
                name: z.string().optional(),
              })
              .optional(),
            observationTokens: z.number().min(1).optional(),
            blockAfter: z.number().min(0).optional(),
            bufferActivation: z.number().min(0).max(1).optional(),
          })
          .optional(),
      })
      .optional(),
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

const inMemoryFileNodeSchema: z.ZodType<InMemoryFileNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['file', 'folder']),
    content: z.string().optional(),
    children: z.array(inMemoryFileNodeSchema).optional(),
  }),
);

const skillFormValueSchema = z.object({
  localId: z.string(),
  name: z.string().min(1, 'Skill name is required'),
  description: z.string(),
  workspaceId: z.string().min(1, 'Workspace is required'),
  files: z.array(inMemoryFileNodeSchema),
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
  integrationTools: z.record(z.string(), entityConfigSchema).optional(),
  workflows: z.record(z.string(), entityConfigSchema).optional(),
  agents: z.record(z.string(), entityConfigSchema).optional(),
  scorers: z.record(z.string(), scorerConfigSchema).optional(),
  memory: memoryConfigSchema.optional(),
  variables: z.custom<JsonSchema>().optional(),
  instructionBlocks: z.array(instructionBlockSchema).optional(),
  mcpClients: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1),
        description: z.string().optional(),
        servers: z.record(z.string(), z.any()),
        selectedTools: z
          .record(
            z.string(),
            z.object({
              description: z.string().optional(),
            }),
          )
          .optional()
          .default({}),
      }),
    )
    .optional()
    .default([]),
  mcpClientsToDelete: z.array(z.string()).optional().default([]),
  skills: z.record(z.string(), skillConfigSchema).optional().default({}),
  workspace: z
    .discriminatedUnion('type', [
      z.object({ type: z.literal('id'), workspaceId: z.string() }),
      z.object({ type: z.literal('inline'), config: z.record(z.string(), z.unknown()) }),
    ])
    .optional(),
});

export type AgentFormValues = z.infer<typeof agentFormSchema>;
export type EntityConfig = z.infer<typeof entityConfigSchema>;
export type ScorerConfig = z.infer<typeof scorerConfigSchema>;
export type SkillConfig = z.infer<typeof skillConfigSchema>;
