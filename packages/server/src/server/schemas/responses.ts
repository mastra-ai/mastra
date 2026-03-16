import z from 'zod';

export const responseIdPathParams = z.object({
  responseId: z.string().describe('Unique identifier for the stored response'),
});

export const responseInputTextPartSchema = z.object({
  type: z.enum(['input_text', 'text', 'output_text']),
  text: z.string(),
});

export const responseInputMessageSchema = z.object({
  role: z.enum(['system', 'developer', 'user', 'assistant']),
  content: z.union([z.string(), z.array(responseInputTextPartSchema)]),
});

export const createResponseBodySchema = z
  .object({
    model: z.string().describe('Mastra agent ID used to resolve the target agent'),
    input: z.union([z.string(), z.array(responseInputMessageSchema)]),
    instructions: z.string().optional(),
    stream: z.boolean().optional().default(false),
    store: z.boolean().optional().default(false),
    previous_response_id: z.string().optional(),
  })
  .passthrough();

export const responseOutputTextSchema = z.object({
  type: z.literal('output_text'),
  text: z.string(),
});

export const responseOutputMessageSchema = z.object({
  id: z.string(),
  type: z.literal('message'),
  role: z.literal('assistant'),
  status: z.enum(['in_progress', 'completed', 'incomplete']),
  content: z.array(responseOutputTextSchema),
});

export const responseUsageSchema = z.object({
  input_tokens: z.number(),
  output_tokens: z.number(),
  total_tokens: z.number(),
});

export const responseObjectSchema = z.object({
  id: z.string(),
  object: z.literal('response'),
  created_at: z.number(),
  model: z.string(),
  status: z.enum(['in_progress', 'completed', 'incomplete']),
  output: z.array(responseOutputMessageSchema),
  usage: responseUsageSchema.nullable(),
  instructions: z.string().nullable().optional(),
  previous_response_id: z.string().nullable().optional(),
  store: z.boolean().optional(),
});

export const deleteResponseSchema = z.object({
  id: z.string(),
  object: z.literal('response'),
  deleted: z.literal(true),
});
