import { z } from 'zod';
import { accountSchema, identifierSchema, positiveQuantitySchema, quantitySchema } from './contracts.js';

export function workflowSuspensionTtlMs(policy: { readonly suspendedReservationTtlMs?: number }) {
  return policy.suspendedReservationTtlMs ?? 1_800_000;
}

export const reservationBudgetSchema = z.strictObject({
  executionMs: positiveQuantitySchema.max(3_600_000).default(120_000),
  finalizationMs: positiveQuantitySchema.max(300_000).default(30_000),
  expiryMarginMs: positiveQuantitySchema.min(1_000).max(300_000).default(30_000),
  lifetimeMs: positiveQuantitySchema.max(86_400_000).default(2_000_000),
});
export const reservationRequestSchema = z
  .strictObject({
    id: identifierSchema,
    account: accountSchema,
    meter: identifierSchema,
    units: positiveQuantitySchema,
    executionCutoff: positiveQuantitySchema,
    confirmationCutoff: positiveQuantitySchema,
    expiresAt: positiveQuantitySchema,
  })
  .refine(value => value.executionCutoff < value.confirmationCutoff && value.confirmationCutoff < value.expiresAt);
export type ReservationRequest = Readonly<z.infer<typeof reservationRequestSchema>>;
export const finalizationRequestSchema = z
  .strictObject({
    reservation: reservationRequestSchema,
    action: z.enum(['confirm', 'release']),
    units: quantitySchema,
  })
  .refine(value => value.units <= value.reservation.units && (value.action !== 'release' || value.units === 0));
export type FinalizationRequest = Readonly<z.infer<typeof finalizationRequestSchema>>;
export type ReserveResult = { readonly status: 'reserved' | 'denied' | 'uncertain'; readonly evidence?: string };
export type FinalizationResult = {
  readonly status: 'confirmed' | 'released' | 'uncertain';
  readonly evidence?: string;
};

// Preparation is deterministic and has no external effects. The gateway commits
// these opaque bytes before dispatch. Neither mutation is assumed replay safe.
export interface ReservationProtocol {
  prepareReservation(request: ReservationRequest): string;
  validateBinding?(payload: string): void;
  reserve(payload: string): Promise<ReserveResult>;
  prepareFinalization(request: FinalizationRequest, reservationPayload: string): string;
  finalize(payload: string): Promise<FinalizationResult>;
  reconcileFinalization(payload: string): Promise<FinalizationResult>;
}
export function prepaid(policy: { charge: { type: string; funding?: string } }) {
  return policy.charge.type === 'credits' || (policy.charge.type !== 'none' && policy.charge.funding === 'prepaid');
}
