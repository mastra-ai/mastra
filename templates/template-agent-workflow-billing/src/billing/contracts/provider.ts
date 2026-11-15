import type { ReservationProtocol } from './reservations.js';
import type {
  ProviderCapabilities,
  OrganizationBillingProfile,
  ProviderAccount,
  CommercialSnapshot,
  UsageBinding,
  UsageEvent,
  UsageDelivery,
  ReconciliationRequest,
  ReconciliationResult,
  CheckoutRequest,
  PortalRequest,
  PreparedHostedSession,
  HostedSession,
  RawWebhookRequest,
  ProviderNotification,
} from './core.js';

/** Contract implemented by every billing driver. Credentials remain driver-owned. */
export interface BillingProvider {
  /** Atomic prepaid reservation protocol, required for prepaid policies. */
  readonly reservations?: ReservationProtocol;
  /** Stable driver identifier selected by BILLING_PROVIDER. */
  readonly id: string;
  /** Features supported by this driver; unsupported policies fail at startup. */
  readonly capabilities: ProviderCapabilities;
  /** Resolve or create the stable account for a trusted workspace; never grant funds. */
  ensureAccount(profile: OrganizationBillingProfile): Promise<ProviderAccount>;
  /** Read current commercial access and balances from the authority. */
  getState(account: ProviderAccount): Promise<CommercialSnapshot>;
  /** Capture the immutable driver binding used by durable usage delivery. */
  bindUsage(meter: string): UsageBinding;
  // Outbox delivery must honor the persisted admission binding. Direct trusted
  // calls without an outbox may use the driver's current configuration.
  /** Deliver an immutable usage event using its persisted admission binding. */
  reportUsage(event: UsageEvent): Promise<UsageDelivery>;
  /** Find positive provider evidence for previously delivered usage. */
  reconcile(request: ReconciliationRequest): Promise<ReconciliationResult>;
  // Providers with a configured payer/plan mapping bind hosted replay to that target.
  /** Bind checkout or portal replay to the configured payer and plan. */
  hostedBinding?(request: CheckoutRequest | PortalRequest): string;
  /** Validate checkout and prepare a closure without dispatching a hosted session. */
  prepareCheckout(request: CheckoutRequest): Promise<PreparedHostedSession>;
  /** Validate portal access and prepare a closure without dispatching a hosted session. */
  preparePortalSession(request: PortalRequest): Promise<PreparedHostedSession>;
  /** Create a hosted checkout session for the trusted product and return URL. */
  createCheckout(request: CheckoutRequest): Promise<HostedSession>;
  /** Create a hosted portal session for the trusted payer and return URL. */
  createPortalSession(request: PortalRequest): Promise<HostedSession>;
  /** Verify raw bytes and headers before accepting a provider notification. */
  verifyWebhook(request: RawWebhookRequest, provider?: string): Promise<ProviderNotification>;
  /** Release driver-owned resources when the billing runtime closes. */
  close?(): void;
}
