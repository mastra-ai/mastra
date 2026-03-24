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

export type ResponseInputMessage = z.infer<typeof responseInputMessageSchema>;

const providerOptionValuesSchema = z.record(z.string(), z.unknown());

const providerOptionsSchema = z
  .object({
    openai: providerOptionValuesSchema
      .optional()
      .describe('OpenAI provider options such as previousResponseId, conversation, or responseId'),
  })
  .passthrough();

export const createResponseBodySchema = z
  .object({
    model: z.string().describe('Model identifier used to generate the response, such as openai/gpt-5'),
    agent_id: z
      .string()
      .optional()
      .describe(
        'Mastra agent ID for the request. Required on initial requests; follow-up stored turns can omit it when using previous_response_id',
      ),
    input: z.union([z.string(), z.array(responseInputMessageSchema)]),
    instructions: z.string().optional(),
    providerOptions: providerOptionsSchema
      .optional()
      .describe('Optional provider-specific options passed through to the underlying model call'),
    stream: z.boolean().optional().default(false),
    store: z.boolean().optional().default(false),
    previous_response_id: z.string().optional(),
  })
  .passthrough()
  .superRefine((body, ctx) => {
    if (!body.agent_id && !body.previous_response_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['agent_id'],
        message:
          'Responses requests require an agent_id, or a previous_response_id from a stored agent-backed response',
      });
    }
  });

export type CreateResponseBody = z.infer<typeof createResponseBodySchema>;

export const responseOutputTextSchema = z.object({
  type: z.literal('output_text'),
  text: z.string(),
  annotations: z.array(z.unknown()).optional(),
  logprobs: z.array(z.unknown()).optional(),
});

export const responseOutputMessageSchema = z.object({
  id: z.string(),
  type: z.literal('message'),
  role: z.literal('assistant'),
  status: z.enum(['in_progress', 'completed', 'incomplete']),
  content: z.array(responseOutputTextSchema),
});

export const responseOutputFunctionCallSchema = z.object({
  id: z.string(),
  type: z.literal('function_call'),
  call_id: z.string(),
  name: z.string(),
  arguments: z.string(),
  status: z.enum(['in_progress', 'completed', 'incomplete']).optional(),
});

export const responseOutputFunctionCallOutputSchema = z.object({
  id: z.string(),
  type: z.literal('function_call_output'),
  call_id: z.string(),
  output: z.string(),
});

export const responseUsageSchema = z.object({
  input_tokens: z.number(),
  output_tokens: z.number(),
  total_tokens: z.number(),
  input_tokens_details: z
    .object({
      cached_tokens: z.number(),
    })
    .optional(),
  output_tokens_details: z
    .object({
      reasoning_tokens: z.number(),
    })
    .optional(),
});

export type ResponseUsage = z.infer<typeof responseUsageSchema>;

export const responseToolSchema = z.object({
  type: z.literal('function'),
  name: z.string(),
  description: z.string().optional(),
  parameters: z.unknown().optional(),
});

export type ResponseTool = z.infer<typeof responseToolSchema>;

export const responseOutputItemSchema = z.union([
  responseOutputMessageSchema,
  responseOutputFunctionCallSchema,
  responseOutputFunctionCallOutputSchema,
]);

export type ResponseOutputItem = z.infer<typeof responseOutputItemSchema>;

export const responseObjectSchema = z.object({
  id: z.string(),
  object: z.literal('response'),
  created_at: z.number(),
  completed_at: z.number().nullable(),
  model: z.string(),
  status: z.enum(['in_progress', 'completed', 'incomplete']),
  output: z.array(responseOutputItemSchema),
  usage: responseUsageSchema.nullable(),
  error: z.null().optional(),
  incomplete_details: z.null().optional(),
  instructions: z.string().nullable().optional(),
  previous_response_id: z.string().nullable().optional(),
  providerOptions: providerOptionsSchema.optional(),
  tools: z.array(responseToolSchema).optional(),
  store: z.boolean().optional(),
});

export type ResponseObject = z.infer<typeof responseObjectSchema>;

export const deleteResponseSchema = z.object({
  id: z.string(),
  object: z.literal('response'),
  deleted: z.literal(true),
});

export type DeleteResponse = z.infer<typeof deleteResponseSchema>;
