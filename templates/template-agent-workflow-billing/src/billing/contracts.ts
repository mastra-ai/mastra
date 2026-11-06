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
  | 'storage_unavailable';

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
};

export class BillingError extends Error {
  readonly retryable: boolean;

  constructor(readonly code: BillingErrorCode) {
    super(messages[code]);
    this.name = 'BillingError';
    this.retryable = code === 'storage_unavailable';
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
  readonly entitlements: boolean;
  readonly subscriptions: boolean;
  readonly prepaid: boolean;
  readonly metered: boolean;
  readonly replaySafeUsage: boolean;
  readonly reconciliation: 'reflected-events' | 'unverified';
  readonly checkout: boolean;
  readonly portal: boolean;
  readonly webhooks: boolean;
}

export interface CommercialGrant {
  readonly key: string;
  readonly validFrom: string;
  readonly validUntil: string | null;
}

export interface CommercialSnapshot {
  readonly account: ProviderAccount;
  readonly observedAt: string;
  readonly validUntil: string | null;
  readonly entitlements: readonly CommercialGrant[];
  readonly subscriptions: readonly CommercialGrant[];
  readonly meters: readonly {
    key: string;
    funding: 'prepaid' | 'metered';
    confirmedBalance: number | null;
    consumedUnits: number;
    periodStart: string | null;
    periodEnd: string | null;
  }[];
  readonly evidence: { readonly version: string } | null;
}

export type Unsupported = { readonly status: 'unsupported'; readonly reason: 'local_mode' };
export type UsageDelivery =
  | { readonly status: 'accepted' | 'duplicate'; readonly eventId: string }
  | { readonly status: 'retryable_failure' | 'permanent_failure' | 'uncertain'; readonly code: string };
export interface ReconciliationRequest {
  readonly account: ProviderAccount;
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
  readonly account: ProviderAccount;
  readonly product: string;
  readonly returnUrl: string;
}
export interface PortalRequest {
  readonly account: ProviderAccount;
  readonly returnUrl: string;
}
export type HostedSession = Unsupported | { readonly status: 'created'; readonly url: string };
export interface RawWebhookRequest {
  readonly body: Uint8Array;
  readonly headers: Readonly<Record<string, string>>;
}
export type ProviderNotification =
  | Unsupported
  | {
      readonly status: 'verified';
      readonly id: string;
      readonly accountReference: string;
      readonly occurredAt: string;
    };

export interface BillingProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  ensureAccount(profile: OrganizationBillingProfile): Promise<ProviderAccount>;
  getState(account: ProviderAccount): Promise<CommercialSnapshot>;
  reportUsage(event: UsageEvent): Promise<UsageDelivery>;
  reconcile(request: ReconciliationRequest): Promise<ReconciliationResult>;
  createCheckout(request: CheckoutRequest): Promise<HostedSession>;
  createPortalSession(request: PortalRequest): Promise<HostedSession>;
  verifyWebhook(request: RawWebhookRequest): Promise<ProviderNotification>;
}
