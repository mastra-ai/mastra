import { z } from 'zod/v4';

export const lastMessagesSchema = z.union([
  z.number(),
  z.literal(false),
  z
    .object({
      maxMessages: z.number().int().nonnegative().optional(),
      maxTokens: z.number().nonnegative().optional(),
      atMaxRemoveTokens: z.number().nonnegative().optional(),
    })
    .refine(
      value =>
        value.atMaxRemoveTokens === undefined ||
        (value.maxTokens !== undefined && value.atMaxRemoveTokens <= value.maxTokens),
      {
        message: 'atMaxRemoveTokens requires maxTokens and cannot exceed it',
      },
    ),
]);
