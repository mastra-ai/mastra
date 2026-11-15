import { z } from 'zod';

export const identifierSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);
export const quantitySchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const positiveQuantitySchema = quantitySchema.refine(value => value > 0);
export const timestampSchema = z.iso.datetime({ offset: true });

export type BillingErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid_configuration'
  | 'invalid_input'
  | 'unsupported'
  | 'account_not_found'
  | 'conflict'
  | 'insufficient_credits'
  | 'storage_incompatible'
  | 'storage_unavailable'
  | 'state_unavailable';

const messages: Record<BillingErrorCode, string> = {
  unauthenticated: 'Valid credentials are required.',
  forbidden: 'This operation is not permitted.',
  invalid_configuration: 'Billing configuration is invalid or unsupported.',
  invalid_input: 'Billing input is invalid.',
  unsupported: 'This billing operation is unavailable.',
  account_not_found: 'The billing account was not found.',
  conflict: 'Billing state conflicts with the requested operation.',
  insufficient_credits: 'The billing account has insufficient credits.',
  storage_incompatible: 'Billing storage is incompatible with this version.',
  storage_unavailable: 'Billing storage is unavailable. Retry later.',
  state_unavailable: 'Billing state is unavailable. Retry later.',
};

export class BillingError extends Error {
  readonly retryable: boolean;

  constructor(readonly code: BillingErrorCode) {
    super(messages[code]);
    this.name = 'BillingError';
    this.retryable = code === 'storage_unavailable' || code === 'state_unavailable';
  }
}

export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new BillingError('invalid_input');
  return result.data;
}

export const accountSchema = z.strictObject({
  id: identifierSchema,
  workspaceId: identifierSchema,
  provider: identifierSchema,
  externalReference: z
    .string()
    .min(1)
    .max(256)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/),
});
export type ProviderAccount = Readonly<z.infer<typeof accountSchema>>;
export const organizationProfileSchema = z.strictObject({ workspaceId: identifierSchema });
export type OrganizationBillingProfile = z.infer<typeof organizationProfileSchema>;

export const usageEventSchema = z.strictObject({
  id: identifierSchema,
  executionId: identifierSchema,
  account: accountSchema,
  policyVersion: identifierSchema,
  meter: identifierSchema,
  units: positiveQuantitySchema,
  occurredAt: timestampSchema,
  metadata: z
    .strictObject({
      resourceId: identifierSchema.optional(),
      resourceKind: z.enum(['agent', 'workflow']).optional(),
    })
    .default({}),
});
export type UsageEvent = z.input<typeof usageEventSchema>;

export interface ProviderCapabilities {
  /** Whether the driver can enforce named feature entitlements. */
  readonly entitlements: boolean;
  /** Whether the driver can enforce subscription access. */
  readonly subscriptions: boolean;
  /** Whether the driver can reserve and settle prepaid credit. */
  readonly prepaid: boolean;
  /** Whether the driver can deliver postpaid consumption. */
  readonly metered: boolean;
  /** Whether repeated delivery of the same usage event is safe. */
  readonly replaySafeUsage: boolean;
  /** How positive evidence of delivered usage can be obtained. */
  readonly reconciliation: 'reflected-events' | 'unverified';
  /** Marks provider reservations as the authority for prepaid settlement. */
  readonly prepaidAuthority?: 'provider-reservations';
  /** Whether hosted checkout is supported. */
  readonly checkout: boolean;
  /** Whether a hosted billing portal is supported. */
  readonly portal: boolean;
  /** Whether signed provider notifications can be verified. */
  readonly webhooks: boolean;
}

export interface CommercialGrant {
  /** Stable logical commercial key referenced by billing policies. */
  readonly key: string;
  /** Inclusive start of grant validity as an ISO timestamp. */
  readonly validFrom: string;
  /** Exclusive expiry timestamp, or null when no expiry is known. */
  readonly validUntil: string | null;
}

export interface CommercialSnapshot {
  /** Stable provider account associated with the authenticated workspace. */
  readonly account: ProviderAccount;
  /** ISO timestamp when the authoritative state was read. */
  readonly observedAt: string;
  /** Exclusive expiry timestamp, or null when no expiry is known. */
  readonly validUntil: string | null;
  /** Named feature grants with their current validity windows. */
  readonly entitlements: readonly CommercialGrant[];
  /** Active subscription grants with their current validity windows. */
  readonly subscriptions: readonly CommercialGrant[];
  /** Authoritative balance and consumption observations per logical meter. */
  readonly meters: readonly {
    /** Stable logical commercial key referenced by billing policies. */
    key: string;
    /** Selects prepaid reservations or metered postpaid usage. */
    funding: 'prepaid' | 'metered';
    /** Available prepaid balance, or null for metered usage. */
    confirmedBalance: number | null;
    /** Confirmed consumption, or null when the provider cannot report it separately. */
    consumedUnits: number | null;
    /** Provider usage observation that may include active holds; never confirmed consumption. */
    providerUsageIncludingHolds?: number;
    /** Inclusive billing period start, or null for nonperiodic credit. */
    periodStart: string | null;
    /** Exclusive billing period end, or null for nonperiodic credit. */
    periodEnd: string | null;
  }[];
  /** Opaque provider evidence used to reconcile financial state. */
  readonly evidence: { readonly version: string } | null;
  /** Marks provider reservations as the authority for prepaid settlement. */
  readonly prepaidAuthority?: 'provider-reservations';
}

export type Unsupported = { readonly status: 'unsupported'; readonly reason: 'local_mode' };
export type UsageDelivery =
  | { readonly status: 'accepted' | 'duplicate'; readonly eventId: string }
  | { readonly status: 'retryable_failure' | 'permanent_failure' | 'uncertain'; readonly code: string };
export interface ReconciliationRequest {
  /** Stable provider account associated with the authenticated workspace. */
  readonly account: ProviderAccount;
  /** Immutable usage IDs whose acceptance must be checked. */
  readonly eventIds: readonly string[];
}
export type ReconciliationResult =
  | {
      readonly status: 'confirmed';
      readonly reflectedEventIds: readonly string[];
      readonly snapshot: CommercialSnapshot;
    }
  | { readonly status: 'unverified'; readonly snapshot: CommercialSnapshot | null };
export interface CheckoutRequest {
  /** Stable provider account associated with the authenticated workspace. */
  readonly account: ProviderAccount;
  /** Logical catalog offer key, resolved by the selected driver. */
  readonly product: string;
  /** Explicitly allowlisted redirect URL for the hosted session. */
  readonly returnUrl: string;
}
export interface PortalRequest {
  /** Stable provider account associated with the authenticated workspace. */
  readonly account: ProviderAccount;
  /** Explicitly allowlisted redirect URL for the hosted session. */
  readonly returnUrl: string;
}
export type HostedSession = Unsupported | { readonly status: 'created'; readonly url: string };
// Preparation must not create a hosted session. The caller durably fences
// dispatch before invoking this closure; any dispatch failure is uncertain.
export type PreparedHostedSession =
  | Unsupported
  | {
      readonly status: 'prepared';
      readonly dispatch: () => Promise<HostedSession>;
    };
export interface RawWebhookRequest {
  /** Unmodified HTTP request bytes used for signature verification. */
  readonly body: Uint8Array;
  /** HTTP headers required by the provider signature protocol. */
  readonly headers: Readonly<Record<string, string>>;
}
export type ProviderNotification =
  | Unsupported
  | {
      readonly status: 'verified';
      readonly id: string;
      readonly accountReference: string | null;
      readonly digest: string;
      readonly type: string;
      readonly occurredAt: string;
    };

// Provider-owned, versioned delivery configuration. Accounting stores these bytes
// at admission and never interprets the opaque data.
export const usageBindingSchema = z
  .strictObject({
    provider: identifierSchema,
    meter: identifierSchema,
    version: positiveQuantitySchema,
    data: z.string().min(1).max(8192),
  })
  .refine(binding => Buffer.byteLength(JSON.stringify(binding)) <= 16384);
export type UsageBinding = Readonly<z.infer<typeof usageBindingSchema>>;
