import { BillingDatabase } from '../../storage/database.js';
import { retainCatalog } from '../../storage/catalog.js';
import { reservationRequestSchema, finalizationRequestSchema } from '../../contracts/reservations.js';
import type { BillingProvider } from '../../contracts/provider.js';
import type {
  CheckoutRequest,
  CommercialSnapshot,
  HostedSession,
  PreparedHostedSession,
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
  UsageBinding,
} from '../../contracts/core.js';
import { organizationProfileSchema, parseInput } from '../../contracts/core.js';
import { localAccountSeedSchema } from '../../configuration/policy.js';
import type { BillingConfiguration, LocalAccountSeed } from '../../configuration/policy.js';
import { LocalBillingStorage } from './storage.js';

export const localCapabilities: ProviderCapabilities = Object.freeze({
  entitlements: true,
  subscriptions: true,
  prepaid: true,
  prepaidAuthority: 'provider-reservations',
  metered: true,
  replaySafeUsage: true,
  reconciliation: 'reflected-events',
  checkout: false,
  portal: false,
  webhooks: false,
});

export class LocalBillingProvider implements BillingProvider {
  readonly id = 'local';
  readonly reservations = {
    prepareReservation: (request: unknown) => JSON.stringify(reservationRequestSchema.parse(request)),
    reserve: (payload: string) => this.storage.reserve(payload),
    prepareFinalization: (request: unknown, _payload: string) =>
      JSON.stringify(finalizationRequestSchema.parse(request)),
    finalize: (payload: string) => this.storage.finalize(payload),
    reconcileFinalization: (payload: string) => this.storage.finalize(payload, true),
  };
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

  close() {
    this.storage.close();
  }

  ensureAccount(profile: OrganizationBillingProfile): Promise<ProviderAccount> {
    const parsed = parseInput(organizationProfileSchema, profile);
    return this.storage.ensureAccount(parsed, this.seeds.get(parsed.workspaceId));
  }

  getState(account: ProviderAccount): Promise<CommercialSnapshot> {
    return this.storage.getState(account);
  }

  bindUsage(meter: string): UsageBinding {
    return { provider: this.id, meter, version: 1, data: '{}' };
  }

  reportUsage(event: UsageEvent): Promise<UsageDelivery> {
    return this.storage.reportUsage(event);
  }

  reconcile(request: ReconciliationRequest): Promise<ReconciliationResult> {
    return this.storage.reconcile(request);
  }

  async prepareCheckout(_request: CheckoutRequest): Promise<PreparedHostedSession> {
    return { status: 'unsupported', reason: 'local_mode' };
  }

  async preparePortalSession(_request: PortalRequest): Promise<PreparedHostedSession> {
    return { status: 'unsupported', reason: 'local_mode' };
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

/** Local simulation needs no payment credentials or remote service. */
export async function openLocalProvider(options: {
  storage: { url: string };
  configuration: BillingConfiguration;
  environment: NodeJS.ProcessEnv;
}): Promise<BillingProvider> {
  const database = await BillingDatabase.open(options.storage);
  try {
    await retainCatalog(database, options.configuration.catalog);
  } finally {
    database.close();
  }
  const storage = await LocalBillingStorage.open(options.storage);
  return new LocalBillingProvider(storage, options.configuration);
}
