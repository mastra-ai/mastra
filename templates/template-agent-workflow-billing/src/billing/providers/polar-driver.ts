import { z } from 'zod';
import { commercialCatalogSchema } from '../catalog.js';
import type { CommercialCatalog } from '../catalog.js';
import { freezeConfiguration } from '../configuration.js';
import { BillingError } from '../contracts.js';
import type {
  CheckoutRequest,
  PortalRequest,
  ProviderAccount,
  ProviderCapabilities,
  UsageEvent,
  UsageBinding,
  RawWebhookRequest,
} from '../contracts.js';
import type { BillingDriver, ExternalAccount } from '../driver.js';
import { polarBindingsSchema, polarCatalogConfigurationSchema } from './polar-contract.js';
import type { BillingContactResolver, PolarBindings } from './polar-contract.js';
import { PolarTransport } from './polar-transport.js';
import { PolarAccounts } from './polar-accounts.js';
import { PolarObservation } from './polar-observation.js';
import { PolarUsage } from './polar-usage.js';
import { PolarHosted } from './polar-hosted.js';
import { verifyPolarWebhook } from './polar-webhooks.js';

export const polarCapabilities: ProviderCapabilities = Object.freeze({
  entitlements: true,
  subscriptions: true,
  prepaid: true,
  metered: true,
  replaySafeUsage: true,
  reconciliation: 'unverified',
  prepaidAuthority: 'application-ledger',
  checkout: true,
  portal: true,
  webhooks: true,
});

export class PolarBillingDriver implements BillingDriver {
  readonly id = 'polar';
  readonly legacySourceKeys = true;
  readonly capabilities = polarCapabilities;
  readonly configuration: PolarBindings;
  private readonly accounts: PolarAccounts;
  private readonly observation: PolarObservation;
  private readonly usage: PolarUsage;
  private readonly hosted: PolarHosted;
  get publicBindings() {
    return JSON.stringify(this.configuration);
  }
  constructor(
    configuration: unknown,
    catalog: CommercialCatalog,
    token: string,
    contact: BillingContactResolver,
    private readonly webhookSecret?: string,
  ) {
    const parsed = polarBindingsSchema.safeParse(configuration);
    if (!parsed.success || !token || /[\r\n]/.test(token) || typeof contact !== 'function')
      throw new BillingError('invalid_configuration');
    if (
      webhookSecret !== undefined &&
      !z
        .string()
        .min(1)
        .max(4096)
        .regex(/^[^\r\n]+$/)
        .refine(value => value.trim().length > 0)
        .safeParse(webhookSecret).success
    )
      throw new BillingError('invalid_configuration');
    const catalogTerms = commercialCatalogSchema.safeParse(catalog);
    if (
      !catalogTerms.success ||
      !polarCatalogConfigurationSchema.safeParse({ polar: parsed.data, catalog: catalogTerms.data }).success
    )
      throw new BillingError('invalid_configuration');
    freezeConfiguration(parsed.data);
    freezeConfiguration(catalogTerms.data);
    this.configuration = parsed.data;
    const transport = new PolarTransport(this.configuration.server, token);
    this.accounts = new PolarAccounts(this.configuration, transport, contact);
    this.observation = new PolarObservation(this.configuration, catalogTerms.data, transport, this.accounts);
    this.usage = new PolarUsage(this.configuration, transport);
    this.hosted = new PolarHosted(this.configuration, catalogTerms.data, transport);
  }
  validateAccount(account: ProviderAccount, link: ExternalAccount) {
    if (
      account.provider !== this.id ||
      link.organizationId !== this.configuration.organizationId ||
      link.externalReference !== account.externalReference ||
      account.externalReference !== `workspace:${account.workspaceId}`
    )
      throw new BillingError('conflict');
  }
  ensureAccount(input: { workspaceId: string }) {
    return this.accounts.ensureAccount(input);
  }
  observe(account: ProviderAccount, observation: ExternalAccount) {
    return this.observation.observe(account, observation);
  }
  bindUsage(meter: string) {
    return this.usage.bindUsage(meter);
  }
  normalizeUsage(input: UsageEvent, binding: UsageBinding) {
    return this.usage.normalizeUsage(input, binding);
  }
  validateUsage(payload: string, input: UsageEvent, binding: UsageBinding | null) {
    return this.usage.validateUsage(payload, input, binding);
  }
  sendUsage(payload: string) {
    return this.usage.sendUsage(payload);
  }
  prepareCheckout(request: CheckoutRequest, link: ExternalAccount) {
    return this.hosted.prepareCheckout(request, link);
  }
  preparePortalSession(request: PortalRequest, link: ExternalAccount) {
    return this.hosted.preparePortalSession(request, link);
  }
  verifyWebhook(request: RawWebhookRequest) {
    return verifyPolarWebhook(request, this.webhookSecret);
  }
}
