import { z } from 'zod/v4';

export const lastMessagesSchema = z.union([z.number().int().nonnegative(), z.literal(false)]);

export const messageTokensSchema = z
  .object({
    maxTokens: z.number().nonnegative(),
    atMaxRemoveTokens: z.number().nonnegative().optional(),
  })
  .refine(value => value.atMaxRemoveTokens === undefined || value.atMaxRemoveTokens <= value.maxTokens, {
    message: 'atMaxRemoveTokens cannot exceed maxTokens',
  });
