import z from 'zod';

// Path parameter schemas
export const processorIdPathParams = z.object({
  processorId: z.string().describe('Unique identifier for the processor'),
});

/**
 * Schema for processor configuration (how it's attached to an agent)
 */
export const processorConfigurationSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  type: z.enum(['input', 'output']),
});

/**
 * Schema for processor configuration in list response (simplified)
 */
const processorListConfigurationSchema = z.object({
  agentId: z.string(),
  type: z.enum(['input', 'output']),
});

/**
 * Schema for processor in list response
 */
export const serializedProcessorSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  phases: z.array(z.enum(['input', 'inputStep', 'outputStream', 'outputResult', 'outputStep'])),
  agentIds: z.array(z.string()),
  configurations: z.array(processorListConfigurationSchema),
  isWorkflow: z.boolean(),
});

/**
 * Schema for detailed processor response
 */
export const serializedProcessorDetailSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  phases: z.array(z.enum(['input', 'inputStep', 'outputStream', 'outputResult', 'outputStep'])),
  configurations: z.array(processorConfigurationSchema),
  isWorkflow: z.boolean(),
});

/**
 * Schema for list processors endpoint response
 */
export const listProcessorsResponseSchema = z.record(z.string(), serializedProcessorSchema);

/**
 * Schema for message content in processor execution
 */
const messageContentSchema = z
  .object({
    format: z.literal(2).optional(),
    parts: z.array(z.any()).optional(),
    content: z.string().optional(),
  })
  .passthrough();

/**
 * Schema for a message in processor execution
 */
const processorMessageSchema = z
  .object({
    id: z.string(),
    role: z.enum(['user', 'assistant', 'system', 'tool']),
    createdAt: z.coerce.date().optional(),
    content: z.union([messageContentSchema, z.string()]),
  })
  .passthrough();

/**
 * Body schema for executing a processor
 */
export const executeProcessorBodySchema = z.object({
  phase: z.enum(['input', 'inputStep', 'outputStream', 'outputResult', 'outputStep']),
  messages: z.array(processorMessageSchema),
  agentId: z.string().optional(),
  requestContext: z.record(z.string(), z.any()).optional(),
});

/**
 * Schema for tripwire result
 */
const tripwireSchema = z.object({
  triggered: z.boolean(),
  reason: z.string().optional(),
  metadata: z.any().optional(),
});

/**
 * Response schema for processor execution
 */
export const executeProcessorResponseSchema = z.object({
  success: z.boolean(),
  phase: z.string(),
  messages: z.array(processorMessageSchema).optional(),
  messageList: z
    .object({
      messages: z.array(processorMessageSchema),
    })
    .optional(),
  tripwire: tripwireSchema.optional(),
  error: z.string().optional(),
});
