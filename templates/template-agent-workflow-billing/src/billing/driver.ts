import { z } from 'zod';
import { createHash } from 'node:crypto';
import { allowanceSchema, catalogReferenceSchema, resolveAllowance } from './catalog.js';
import type { CommercialCatalog } from './catalog.js';
import { snapshotSchema, refineCommercialState } from './accounting.js';
import { accountSchema, grantSourceSchema, identifierSchema, timestampSchema } from './contracts.js';
import type {
  CheckoutRequest,
  OrganizationBillingProfile,
  PortalRequest,
  PreparedHostedSession,
  ProviderAccount,
  ProviderCapabilities,
  ProviderNotification,
  RawWebhookRequest,
  UsageBinding,
  UsageDelivery,
  UsageEvent,
} from './contracts.js';

export const externalAccountSchema = z.strictObject({
  customerId: identifierSchema,
  organizationId: identifierSchema,
  externalReference: accountSchema.shape.externalReference,
});
export type ExternalAccount = Readonly<z.infer<typeof externalAccountSchema>>;
export const driverObservationSchema = z.strictObject({
  account: externalAccountSchema,
  sources: z.array(z.strictObject({ allowance: catalogReferenceSchema, source: grantSourceSchema })).max(10000),
  commercial: z
    .strictObject({
      entitlements: snapshotSchema.shape.entitlements,
      subscriptions: snapshotSchema.shape.subscriptions,
      meters: snapshotSchema.shape.meters,
    })
    .superRefine(refineCommercialState),
});
export type DriverObservation = z.infer<typeof driverObservationSchema>;

// Provider-specific evidence may add fields, but these normalized terms bind
// the original financial contract. Persist the supplied string unchanged.
export const sourceProvenanceSchema = z.looseObject({
  kind: allowanceSchema.shape.kind,
  meter: allowanceSchema.shape.meter,
  units: allowanceSchema.shape.units,
  version: allowanceSchema.shape.version,
  expiry: allowanceSchema.shape.expiry,
  validFrom: timestampSchema,
});

// The application validates source terms against immutable catalog revisions;
// external evidence never becomes authority for arbitrary financial quantities.
export function catalogObservationSchema(catalog: CommercialCatalog) {
  return driverObservationSchema.superRefine((observation, context) => {
    const keys = observation.sources.map(value => value.source.key);
    if (new Set(keys).size !== keys.length) context.addIssue({ code: 'custom', message: 'Duplicate source identity.' });
    for (const { allowance: reference, source } of observation.sources) {
      const allowance = resolveAllowance(catalog, reference);
      let decoded: unknown;
      try {
        decoded = JSON.parse(source.provenance);
      } catch {
        decoded = null;
      }
      const provenance = sourceProvenanceSchema.safeParse(decoded);
      if (
        createHash('sha256').update(source.provenance).digest('hex') !== source.fingerprint ||
        !allowance ||
        !provenance.success ||
        provenance.data.kind !== source.kind ||
        provenance.data.meter !== source.meter ||
        provenance.data.units !== source.units ||
        provenance.data.version !== allowance.version ||
        provenance.data.validFrom !== source.validFrom ||
        JSON.stringify(provenance.data.expiry) !== JSON.stringify(allowance.expiry) ||
        allowance.meter !== source.meter ||
        allowance.units !== source.units ||
        allowance.kind !== source.kind ||
        (allowance.expiry.type === 'none' && source.validUntil !== null) ||
        (allowance.expiry.type === 'duration' &&
          Date.parse(source.validUntil ?? '') !== Date.parse(source.validFrom) + allowance.expiry.milliseconds) ||
        (allowance.expiry.type === 'period' && source.validUntil === null)
      )
        context.addIssue({ code: 'custom', message: 'Source terms must match the retained allowance revision.' });
    }
  });
}

// External effects only. No database handle or financial-table side effects are
// required: BillingService validates and persists all verified observations.
// Construct drivers only after validating their own binding schema, logical
// catalog/mapping references and destination restrictions. Registration receives
// that validated instance; credentials remain private to its external methods.
export interface BillingDriver {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  // Public, credential-free JSON bindings only; retained for audit. Credentials
  // belong to the driver instance and must never appear here.
  readonly publicBindings: string;
  // Compatibility adapters may retain already shipped global source keys.
  // Ownership conflicts are still rejected transactionally by the application.
  readonly legacySourceKeys?: boolean;
  validateAccount(account: ProviderAccount, link: ExternalAccount): void;
  ensureAccount(profile: OrganizationBillingProfile): Promise<ExternalAccount>;
  observe(account: ProviderAccount, link: ExternalAccount): Promise<DriverObservation>;
  bindUsage(meter: string): UsageBinding;
  // The normalized bytes are retained by the application before dispatch.
  normalizeUsage(event: UsageEvent, binding: UsageBinding): string;
  validateUsage(payload: string, event: UsageEvent, binding: UsageBinding | null): void;
  sendUsage(payload: string): Promise<UsageDelivery>;
  prepareCheckout(request: CheckoutRequest, link: ExternalAccount): Promise<PreparedHostedSession>;
  preparePortalSession(request: PortalRequest, link: ExternalAccount): Promise<PreparedHostedSession>;
  verifyWebhook(request: RawWebhookRequest): Promise<ProviderNotification>;
}
