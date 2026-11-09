import { z } from 'zod/v4';

export const computerIdPathParams = z.object({
  computerId: z.string().min(1),
});

export const computerScopeSchema = z.object({
  threadId: z.string().min(1).optional(),
  resourceId: z.string().min(1).optional(),
});

export const createComputerSessionBodySchema = computerScopeSchema.extend({
  mode: z.enum(['watch', 'control']),
});

export const createComputerSessionResponseSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('ready'), socketUrl: z.string() }),
  z.object({ state: z.literal('not-running') }),
]);

export const getComputerControlQuerySchema = computerScopeSchema;

export const computerControlSchema = z.object({
  holder: z.enum(['agent', 'human']),
  reason: z.string().optional(),
  revision: z.number().int().nonnegative(),
  enforced: z.boolean().optional(),
});

export const changeComputerControlBodySchema = computerScopeSchema.extend({
  action: z.enum(['take', 'release']),
  note: z.string().max(500).optional(),
});

export const changeComputerControlResponseSchema = z.object({
  holder: z.enum(['agent', 'human']),
  revision: z.number().int().nonnegative(),
  notified: z.boolean(),
  reason: z.enum(['no-change', 'no-agent', 'no-notifications-storage', 'not-delivered', 'error']).optional(),
});
