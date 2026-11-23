import { z } from 'zod';

import { idempotencyKeySchema, tenantIdSchema, timestampSchema } from '../../domain/identifiers.js';

export const idempotencyRecordSchema = z
  .object({
    tenantId: tenantIdSchema,
    operation: z.string().min(1).max(100),
    key: idempotencyKeySchema,
    requestFingerprint: z.string().min(1).max(128),
    status: z.enum(['RESERVED', 'COMPLETED']),
    resultJson: z.string().nullable(),
    createdAt: timestampSchema,
    completedAt: timestampSchema.nullable(),
  })
  .strict();

export const reserveIdempotencyInputSchema = idempotencyRecordSchema.pick({
  tenantId: true,
  operation: true,
  key: true,
  requestFingerprint: true,
  createdAt: true,
});
export const completeIdempotencyInputSchema = reserveIdempotencyInputSchema
  .extend({ resultJson: z.string(), completedAt: timestampSchema })
  .strict();
export const reacquireExpiredIdempotencyInputSchema = reserveIdempotencyInputSchema
  .extend({ expiredBefore: timestampSchema })
  .strict();
export const abandonIdempotencyInputSchema = reserveIdempotencyInputSchema
  .pick({
    tenantId: true,
    operation: true,
    key: true,
    requestFingerprint: true,
    createdAt: true,
  })
  .strict();
export const idempotencyReservationSchema = z
  .object({
    record: idempotencyRecordSchema,
    acquired: z.boolean(),
  })
  .strict();

export interface IdempotencyRepository {
  reserve(input: z.infer<typeof reserveIdempotencyInputSchema>): Promise<z.infer<typeof idempotencyReservationSchema>>;
  complete(input: z.infer<typeof completeIdempotencyInputSchema>): Promise<z.infer<typeof idempotencyRecordSchema>>;
  reacquireExpired(
    input: z.infer<typeof reacquireExpiredIdempotencyInputSchema>,
  ): Promise<z.infer<typeof idempotencyReservationSchema>>;
  abandon(input: z.infer<typeof abandonIdempotencyInputSchema>): Promise<boolean>;
  get(tenantId: string, operation: string, key: string): Promise<z.infer<typeof idempotencyRecordSchema> | undefined>;
}
