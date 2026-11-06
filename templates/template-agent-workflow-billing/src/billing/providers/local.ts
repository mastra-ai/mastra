import type {
  BillingProvider,
  CheckoutRequest,
  CommercialSnapshot,
  HostedSession,
  OrganizationBillingProfile,
  PortalRequest,
  ProviderAccount,
  ProviderCapabilities,
  ProviderNotification,
  RawWebhookRequest,
  ReconciliationRequest,
  ReconciliationResult,
  UsageDelivery,
  UsageEvent,
} from '../contracts.js';
import { organizationProfileSchema, parseInput } from '../contracts.js';
import { localAccountSeedSchema } from '../configuration.js';
import type { BillingConfiguration, LocalAccountSeed } from '../configuration.js';
import { LocalBillingStorage } from '../storage/libsql.js';

export const localCapabilities: ProviderCapabilities = Object.freeze({
  entitlements: true,
  subscriptions: true,
  prepaid: true,
  metered: true,
  replaySafeUsage: true,
  reconciliation: 'reflected-events',
  checkout: false,
  portal: false,
  webhooks: false,
});

export class LocalBillingProvider implements BillingProvider {
  readonly id = 'local';
  readonly capabilities = localCapabilities;
  private readonly seeds: ReadonlyMap<string, LocalAccountSeed>;

  constructor(
    private readonly storage: LocalBillingStorage,
    configuration: BillingConfiguration,
  ) {
    this.seeds = new Map(
      configuration.localAccounts.map(seed => [seed.workspaceId, localAccountSeedSchema.parse(seed)]),
    );
  }

  ensureAccount(profile: OrganizationBillingProfile): Promise<ProviderAccount> {
    const parsed = parseInput(organizationProfileSchema, profile);
    return this.storage.ensureAccount(parsed, this.seeds.get(parsed.workspaceId));
  }

  getState(account: ProviderAccount): Promise<CommercialSnapshot> {
    return this.storage.getState(account);
  }

  reportUsage(event: UsageEvent): Promise<UsageDelivery> {
    return this.storage.reportUsage(event);
  }

  reconcile(request: ReconciliationRequest): Promise<ReconciliationResult> {
    return this.storage.reconcile(request);
  }

  async createCheckout(_request: CheckoutRequest): Promise<HostedSession> {
    return { status: 'unsupported', reason: 'local_mode' };
  }

  async createPortalSession(_request: PortalRequest): Promise<HostedSession> {
    return { status: 'unsupported', reason: 'local_mode' };
  }

  async verifyWebhook(_request: RawWebhookRequest): Promise<ProviderNotification> {
    return { status: 'unsupported', reason: 'local_mode' };
  }
}
