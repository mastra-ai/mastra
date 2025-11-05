import z from 'zod';

/**
 * Schema for serialized processor metadata
 */
export const serializedProcessorSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
});

/**
 * Schema for serialized tool with JSON schemas
 */
export const serializedToolSchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  inputSchema: z.string().optional(),
  outputSchema: z.string().optional(),
  requireApproval: z.boolean().optional(),
});

/**
 * Schema for serialized workflow with steps
 */
export const serializedWorkflowSchema = z.object({
  name: z.string(),
  steps: z
    .record(
      z.object({
        id: z.string(),
        description: z.string().optional(),
      }),
    )
    .optional(),
});

/**
 * Schema for serialized agent definition (referenced by other agents)
 */
export const serializedAgentDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
});

/**
 * Schema for SystemMessage type
 * Can be string, string[], or various message objects
 */
const systemMessageSchema = z.union([
  z.string(),
  z.array(z.string()),
  z.object({}).passthrough(), // CoreSystemMessage or SystemModelMessage
  z.array(z.object({}).passthrough()),
]);

/**
 * Schema for model configuration in model list
 */
const modelConfigSchema = z.object({
  model: z.object({
    modelId: z.string(),
    provider: z.string(),
    modelVersion: z.string(),
  }),
  // Additional fields from AgentModelManagerConfig can be added here
});

/**
 * Main schema for serialized agent representation
 */
export const serializedAgentSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  instructions: systemMessageSchema.optional(),
  tools: z.record(serializedToolSchema),
  agents: z.record(serializedAgentDefinitionSchema),
  workflows: z.record(serializedWorkflowSchema),
  inputProcessors: z.array(serializedProcessorSchema),
  outputProcessors: z.array(serializedProcessorSchema),
  provider: z.string().optional(),
  modelId: z.string().optional(),
  modelVersion: z.string().optional(),
  modelList: z.array(modelConfigSchema).optional(),
  defaultOptions: z.record(z.unknown()).optional(),
  defaultGenerateOptionsLegacy: z.record(z.unknown()).optional(),
  defaultStreamOptionsLegacy: z.record(z.unknown()).optional(),
});

/**
 * Schema for agent with ID
 */
export const serializedAgentWithIdSchema = serializedAgentSchema.extend({
  id: z.string(),
});

/**
 * Schema for individual provider information
 */
export const providerSchema = z.object({
  id: z.string(),
  name: z.string(),
  envVar: z.union([z.string(), z.array(z.string())]),
  connected: z.boolean(),
  docUrl: z.string().optional(),
  models: z.array(z.string()),
});

/**
 * Schema for providers endpoint response
 */
export const providersResponseSchema = z.object({
  providers: z.array(providerSchema),
});

/**
 * Schema for list agents endpoint response
 * Returns a record of agent ID to serialized agent
 */
export const listAgentsResponseSchema = z.record(serializedAgentSchema);
