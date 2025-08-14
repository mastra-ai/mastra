import z from 'zod';

// TODO: We need to type this properly
export const llmIterationOutputSchema = z.object({
  messageId: z.string(),
  messages: z.object({
    all: z.array(z.any()),
    user: z.array(z.any()),
    nonUser: z.array(z.any()),
  }),
  output: z.any(),
  metadata: z.any(),
  stepResult: z.any().optional(),
});

export const toolCallInputSchema = z.object({
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.any(),
  providerMetadata: z.any(),
});

export const toolCallOutputSchema = toolCallInputSchema.extend({
  result: z.any(),
  error: z.any().optional(),
});
