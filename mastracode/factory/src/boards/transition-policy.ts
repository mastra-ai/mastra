import { z } from 'zod';

import { FACTORY_TRIAGE_TYPES } from '../rules/types.js';
import type {
  FactoryRuleContextBase,
  FactoryRuleItemContext,
  FactoryRuleRejectionCode,
  FactoryRuleSource,
  FactoryTriageType,
} from '../rules/types.js';

type Immutable<T> = T extends string | number | boolean | bigint | null | undefined
  ? T
  : T extends Date
    ? string
    : T extends object
      ? { readonly [K in keyof T]: Immutable<T[K]> }
      : T;

export type BoardTransitionPolicyContext = Immutable<
  FactoryRuleContextBase & {
    board: string;
    fromStage: string;
    toStage: string;
    source: FactoryRuleSource;
    initialEntry: boolean;
    reenter: boolean;
    itemRevision: number;
    isHumanTransition: boolean;
    requestedTriageType?: FactoryTriageType;
    item: FactoryRuleItemContext & { triageType: FactoryTriageType | null };
  }
>;

export type BoardTransitionPolicyResult =
  | undefined
  | { type: 'allow'; triageType?: FactoryTriageType; accept?: true }
  | { type: 'reject'; code: FactoryRuleRejectionCode; reason: string };

export type BoardTransitionPolicy = (
  context: BoardTransitionPolicyContext,
) => BoardTransitionPolicyResult | Promise<BoardTransitionPolicyResult>;

// Dates are converted rather than frozen: Object.freeze does not prevent Date#setTime.
export function immutablePolicySnapshot<T>(value: T): Immutable<T>;
export function immutablePolicySnapshot(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return Object.freeze(value.map(entry => immutablePolicySnapshot(entry)));
  if (value !== null && typeof value === 'object') {
    if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
      throw new Error('Policy snapshots require plain data.');
    }
    return Object.freeze(
      Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, immutablePolicySnapshot(entry)])),
    );
  }
  if (typeof value === 'function' || typeof value === 'symbol') throw new Error('Policy snapshots require plain data.');
  return value;
}

export const boardTransitionPolicyResultSchema = z.union([
  z.undefined(),
  z.discriminatedUnion('type', [
    z
      .object({
        type: z.literal('allow'),
        triageType: z.enum(FACTORY_TRIAGE_TYPES).optional(),
        accept: z.literal(true).optional(),
      })
      .strict(),
    z
      .object({
        type: z.literal('reject'),
        code: z.enum([
          'forbidden',
          'invalid_transition',
          'missing_binding',
          'stale',
          'timeout',
          'rule_error',
          'causal_depth_exceeded',
          'repeated_transition',
          'approval_required',
        ]),
        reason: z.string().trim().min(1).max(512),
      })
      .strict(),
  ]),
]);
