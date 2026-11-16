import { readConfigurationFile } from '../../configuration/files.js';
import { createHash } from 'node:crypto';
// autumn-js 1.5.72 imports fzstd without declaring it. The pinned MIT fzstd
// dependency supplies that intrinsic SDK runtime dependency on clean installs.
import { Autumn, HTTPClient } from 'autumn-js';
import { z } from 'zod';
import { BillingError, identifierSchema, parseInput, quantitySchema } from '../../contracts/core.js';
import type { BillingProvider } from '../../contracts/provider.js';
import type {
  ProviderAccount,
  CommercialSnapshot,
  CheckoutRequest,
  PortalRequest,
  PreparedHostedSession,
  UsageEvent,
  ReconciliationRequest,
} from '../../contracts/core.js';
import { reservationRequestSchema, finalizationRequestSchema } from '../../contracts/reservations.js';
import type { ReservationProtocol } from '../../contracts/reservations.js';
import { BillingDatabase } from '../../storage/database.js';
import { AutumnAccountStorage } from './storage.js';
import { bindingSchema } from './configuration.js';
export { bindingSchema } from './configuration.js';

export interface AutumnProviderOptions {
  /** Server-only Autumn credential; never persisted in billing configuration snapshots. */
  secretKey: string;
  /** Trusted workspace/customer, meter/feature, credit pool and hosted plan associations. */
  bindings: z.input<typeof bindingSchema>;
  /** Optional loopback endpoint for deterministic provider integration tests. */
  serverURL?: string;
  /** Maximum duration of an Autumn HTTP request in milliseconds. */
  timeoutMs?: number;
}
const reservePayloadSchema = z.strictObject({
  request: reservationRequestSchema,
  customerId: identifierSchema,
  featureId: identifierSchema,
  creditPoolId: identifierSchema,
});
const finalizePayloadSchema = z.strictObject({
  request: finalizationRequestSchema,
  customerId: identifierSchema,
  lockId: identifierSchema,
});
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => JSON.stringify(key) + ':' + canonical(item))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
};

export const autumnCapabilities = Object.freeze({
  entitlements: true,
  subscriptions: true,
  prepaid: true,
  prepaidAuthority: 'provider-reservations' as const,
  metered: false,
  replaySafeUsage: false,
  reconciliation: 'unverified' as const,
  checkout: true,
  portal: true,
  webhooks: false,
});

export class AutumnBillingProvider implements BillingProvider {
  readonly id = 'autumn';
  readonly capabilities = autumnCapabilities;
  readonly reservations: ReservationProtocol;
  private readonly accounts: AutumnAccountStorage;
  private readonly client: Autumn;
  private readonly bindings;
  private constructor(
    private readonly database: BillingDatabase,
    options: AutumnProviderOptions,
  ) {
    this.bindings = parseInput(bindingSchema, options.bindings);
    this.accounts = new AutumnAccountStorage(
      database,
      account => this.customer(account),
      workspaceId => this.bindings.customers.find(value => value.workspaceId === workspaceId),
    );
    if (!options.secretKey.trim()) throw new BillingError('invalid_configuration');
    if (options.serverURL) {
      const url = new URL(options.serverURL);
      if (
        url.protocol !== 'http:' ||
        !['localhost', '127.0.0.1'].includes(url.hostname) ||
        url.username ||
        url.password ||
        url.pathname !== '/'
      )
        throw new BillingError('invalid_configuration');
    }
    const timeoutMs = parseInput(z.number().int().min(100).max(30_000), options.timeoutMs ?? 10_000);
    const httpClient = new HTTPClient();
    httpClient.addHook('response', response => {
      // API 202 may carry allowed/success despite disabled SDK fail-open.
      // Reject before generated response parsing can expose those flags.
      if (response.status !== 200) throw new BillingError('state_unavailable');
    });
    this.client = new Autumn({
      secretKey: options.secretKey,
      xApiVersion: '2.6.0',
      failOpen: false,
      retryConfig: { strategy: 'none' },
      useEdge: false,
      timeoutMs,
      serverURL: options.serverURL,
      httpClient,
    });
    this.reservations = {
      prepareReservation: request => {
        const parsed = reservationRequestSchema.parse(request);
        const binding = this.meter(parsed.meter);
        return JSON.stringify(
          reservePayloadSchema.parse({
            request: parsed,
            customerId: this.customer(parsed.account).customerId,
            featureId: binding.featureId,
            creditPoolId: binding.creditPoolId,
          }),
        );
      },
      validateBinding: payload => this.validateReservation(reservePayloadSchema.parse(JSON.parse(payload))),
      reserve: async payload => {
        const value = reservePayloadSchema.parse(JSON.parse(payload));
        this.validateReservation(value);
        if (Date.now() >= value.request.executionCutoff) return { status: 'uncertain' };
        try {
          await this.verifiedCustomer(value.request.account);
          await this.validateFeature(value.featureId, value.creditPoolId);
          if (Date.now() >= value.request.executionCutoff) return { status: 'uncertain' };
          const result = await this.client.check({
            customerId: value.customerId,
            featureId: value.featureId,
            requiredBalance: value.request.units,
            lock: { enabled: true, lockId: value.request.id, expiresAt: value.request.expiresAt },
          });
          if (result.customerId !== value.customerId || result.requiredBalance !== value.request.units)
            return { status: 'uncertain' };
          if (result.balance === null && result.allowed === false)
            return { status: 'denied', evidence: JSON.stringify(result) };
          this.validateBalance(result.balance, value.creditPoolId);
          return { status: result.allowed === true ? 'reserved' : 'denied', evidence: JSON.stringify(result) };
        } catch {
          return { status: 'uncertain' };
        }
      },
      prepareFinalization: (request, reservationPayload) => {
        const original = reservePayloadSchema.parse(JSON.parse(reservationPayload));
        const parsed = finalizationRequestSchema.parse(request);
        if (
          canonical(parsed.reservation) !== canonical(original.request) ||
          this.customer(original.request.account).customerId !== original.customerId
        )
          throw new BillingError('conflict');
        return JSON.stringify(
          finalizePayloadSchema.parse({
            request: parsed,
            customerId: original.customerId,
            lockId: original.request.id,
          }),
        );
      },
      finalize: async payload => {
        const value = finalizePayloadSchema.parse(JSON.parse(payload));
        try {
          const customer = await this.verifiedCustomer(value.request.reservation.account);
          if (value.lockId !== value.request.reservation.id || value.customerId !== customer.customerId)
            return { status: 'uncertain' };
          if (value.request.action === 'confirm' && Date.now() >= value.request.reservation.confirmationCutoff)
            return { status: 'uncertain' };
          const result = await this.client.balances.finalize(this.finalizeBody(value));
          return result.success === true
            ? {
                status: value.request.action === 'confirm' ? 'confirmed' : 'released',
                evidence: JSON.stringify(result),
              }
            : { status: 'uncertain' };
        } catch {
          return { status: 'uncertain' };
        }
      },
      reconcileFinalization: async payload => {
        const value = finalizePayloadSchema.parse(JSON.parse(payload));
        const expected = this.finalizeBody(value);
        try {
          const customer = await this.verifiedCustomer(value.request.reservation.account);
          if (value.lockId !== value.request.reservation.id || value.customerId !== customer.customerId)
            return { status: 'uncertain' };
          const logs = await this.client.logs.search({
            query: `where customer_id == '${value.customerId}' and request_body.lock_id == '${value.lockId}'`,
            // Reservation lifetimes are bounded to 24 hours. This persisted
            // anchor includes every possible dispatch, even after a long outage.
            range: {
              startDate: new Date(Math.max(0, value.request.reservation.expiresAt - 86_400_000)).toISOString(),
              endDate: new Date().toISOString(),
            },
            limit: 100,
          });
          const wire = {
            customer_id: expected.customerId,
            lock_id: expected.lockId,
            action: expected.action,
            ...(expected.overrideValue === undefined ? {} : { override_value: expected.overrideValue }),
          };
          for (const log of logs.list) {
            const response = log.responseBody as { success?: unknown } | null;
            if (
              log.statusCode === 200 &&
              log.request.path === '/v1/balances.finalize' &&
              canonical(log.requestBody) === canonical(wire) &&
              response?.success === true
            )
              return {
                status: value.request.action === 'confirm' ? 'confirmed' : 'released',
                evidence: JSON.stringify({
                  timestamp: log.timestamp,
                  statusCode: log.statusCode,
                  request: log.requestBody,
                  response: log.responseBody,
                }),
              };
          }
        } catch {
          /* Missing access, retention and eventual indexing remain unknown. */
        }
        return { status: 'uncertain' };
      },
    };
  }
  static async open(storage: { url: string }, options: AutumnProviderOptions) {
    const database = await BillingDatabase.open(storage);
    try {
      return new AutumnBillingProvider(database, options);
    } catch (error) {
      database.close();
      throw error;
    }
  }
  close() {
    this.database.close();
  }
  private meter(key: string) {
    const binding = this.bindings.meters.find(value => value.key === key);
    if (!binding) throw new BillingError('invalid_configuration');
    return binding;
  }
  private customer(account: ProviderAccount) {
    const binding = this.bindings.customers.find(value => value.workspaceId === account.workspaceId);
    if (!binding || account.provider !== this.id || account.externalReference !== `workspace:${binding.workspaceId}`)
      throw new BillingError('conflict');
    return binding;
  }
  private validateReservation(value: z.infer<typeof reservePayloadSchema>) {
    const binding = this.meter(value.request.meter);
    if (
      this.customer(value.request.account).customerId !== value.customerId ||
      binding.featureId !== value.featureId ||
      binding.creditPoolId !== value.creditPoolId
    )
      throw new BillingError('conflict');
  }
  private finalizeBody(value: z.infer<typeof finalizePayloadSchema>) {
    return {
      customerId: value.customerId,
      lockId: value.lockId,
      action: value.request.action,
      ...(value.request.action === 'confirm' ? { overrideValue: value.request.units } : {}),
    };
  }
  private async validateFeature(featureId: string, creditPoolId: string) {
    const [feature, pool] = await Promise.all([
      this.client.features.get({ featureId }),
      this.client.features.get({ featureId: creditPoolId }),
    ]);
    const rates = pool.creditSchema?.filter(rate => rate.meteredFeatureId === featureId) ?? [];
    const rate = rates[0];
    if (
      feature.id !== featureId ||
      feature.type !== 'metered' ||
      !feature.consumable ||
      feature.archived ||
      pool.id !== creditPoolId ||
      pool.type !== 'credit_system' ||
      pool.archived ||
      rates.length !== 1 ||
      !rate ||
      !('creditCost' in rate) ||
      rate.creditCost !== 1 ||
      (rate.billingUnits ?? 1) !== 1 ||
      rate.dimensions ||
      rate.multipliers
    )
      throw new BillingError('state_unavailable');
  }
  private validateBalance(value: unknown, poolId: string) {
    return parseInput(
      z.object({
        featureId: z.literal(poolId),
        remaining: quantitySchema,
        usage: quantitySchema,
        unlimited: z.literal(false),
        overageAllowed: z.literal(false),
      }),
      value,
    );
  }
  private verifiedCustomer(account: ProviderAccount) {
    return this.accounts.verifiedCustomer(account);
  }
  async ensureAccount(input: { workspaceId: string }): Promise<ProviderAccount> {
    const account = await this.accounts.ensureAccount(input);
    const binding = this.customer(account);
    const remote = await this.client.customers.getOrCreate({
      customerId: binding.customerId,
      ...(binding.name ? { name: binding.name } : {}),
      ...(binding.email ? { email: binding.email } : {}),
    });
    if (remote.id !== binding.customerId) throw new BillingError('state_unavailable');
    return account;
  }

  async getState(account: ProviderAccount): Promise<CommercialSnapshot> {
    const customer = await this.verifiedCustomer(account);
    const now = new Date().toISOString();
    const meters = await Promise.all(
      this.bindings.meters.map(async binding => {
        await this.validateFeature(binding.featureId, binding.creditPoolId);
        const result = await this.client.check({ customerId: customer.customerId, featureId: binding.featureId });
        if (result.customerId !== customer.customerId) throw new BillingError('state_unavailable');
        const balance =
          result.balance === null && result.allowed === false
            ? { remaining: 0, usage: 0 }
            : this.validateBalance(result.balance, binding.creditPoolId);
        return {
          key: binding.key,
          funding: 'prepaid' as const,
          confirmedBalance: balance.remaining,
          consumedUnits: null,
          providerUsageIncludingHolds: balance.usage,
          periodStart: null,
          periodEnd: null,
        };
      }),
    );
    const remote = await this.client.customers.get({ customerId: customer.customerId });
    if (remote.id !== customer.customerId) throw new BillingError('state_unavailable');
    const subscriptions = this.bindings.subscriptions.flatMap(binding =>
      (remote.subscriptions ?? [])
        .filter(
          plan =>
            plan.planId === binding.planId &&
            plan.status === 'active' &&
            !plan.pastDue &&
            (plan.expiresAt === null || plan.expiresAt > Date.now()),
        )
        .map(plan => ({
          key: binding.key,
          validFrom: new Date(plan.startedAt).toISOString(),
          validUntil: plan.expiresAt === null ? null : new Date(plan.expiresAt).toISOString(),
        })),
    );
    const entitlements = (
      await Promise.all(
        this.bindings.entitlements.map(async binding => {
          const result = await this.client.check({ customerId: customer.customerId, featureId: binding.featureId });
          return result.customerId === customer.customerId && result.allowed === true
            ? { key: binding.key, validFrom: now, validUntil: null }
            : null;
        }),
      )
    ).filter(value => value !== null);
    return {
      account,
      observedAt: now,
      validUntil: null,
      prepaidAuthority: 'provider-reservations',
      meters,
      subscriptions,
      entitlements,
      evidence: {
        version: createHash('sha256')
          .update(JSON.stringify({ now, meters, subscriptions, entitlements }))
          .digest('hex'),
      },
    };
  }
  bindUsage(meter: string) {
    this.meter(meter);
    return { provider: this.id, meter, version: 1, data: '{}' };
  }
  async reportUsage(_event: UsageEvent): Promise<never> {
    throw new BillingError('unsupported');
  }
  async reconcile(request: ReconciliationRequest) {
    return { status: 'confirmed' as const, reflectedEventIds: [], snapshot: await this.getState(request.account) };
  }
  private hostedCustomer(request: PortalRequest) {
    if (!this.bindings.returnUrls.includes(request.returnUrl)) throw new BillingError('forbidden');
    return this.customer(request.account);
  }

  private checkoutPlan(product: string) {
    const plan = this.bindings.plans.find(value => value.key === product);
    if (!plan) throw new BillingError('forbidden');
    return plan;
  }

  hostedBinding(request: CheckoutRequest | PortalRequest) {
    return JSON.stringify({
      provider: this.id,
      accountId: request.account.id,
      customerId: this.hostedCustomer(request).customerId,
      planId: 'product' in request ? this.checkoutPlan(request.product).planId : null,
    });
  }

  async prepareCheckout(request: CheckoutRequest): Promise<PreparedHostedSession> {
    const returnUrl = request.returnUrl;
    const customer = this.hostedCustomer({ account: request.account, returnUrl });
    const plan = this.checkoutPlan(request.product);
    await this.verifiedCustomer(request.account);
    return {
      status: 'prepared',
      dispatch: async () => {
        const result = await this.client.billing.attach({
          customerId: customer.customerId,
          planId: plan.planId,
          successUrl: returnUrl,
          redirectMode: 'always',
        });
        if (
          result.customerId !== customer.customerId ||
          !result.paymentUrl ||
          !result.paymentUrl.startsWith('https://')
        )
          throw new BillingError('state_unavailable');
        return { status: 'created', url: result.paymentUrl };
      },
    };
  }
  async preparePortalSession(request: PortalRequest): Promise<PreparedHostedSession> {
    const returnUrl = request.returnUrl;
    const customer = this.hostedCustomer({ account: request.account, returnUrl });
    await this.verifiedCustomer(request.account);
    return {
      status: 'prepared',
      dispatch: async () => {
        const result = await this.client.billing.openCustomerPortal({
          customerId: customer.customerId,
          returnUrl,
        });
        if (result.customerId !== customer.customerId || !result.url.startsWith('https://'))
          throw new BillingError('state_unavailable');
        return { status: 'created', url: result.url };
      },
    };
  }
  async createCheckout(request: CheckoutRequest) {
    const result = await this.prepareCheckout(request);
    return result.status === 'prepared' ? result.dispatch() : result;
  }
  async createPortalSession(request: PortalRequest) {
    const result = await this.preparePortalSession(request);
    return result.status === 'prepared' ? result.dispatch() : result;
  }
  async verifyWebhook(): Promise<never> {
    throw new BillingError('unsupported');
  }
}

/** Resolve only Autumn-owned secrets and bindings; no fallback to local billing. */
export async function openAutumnProvider(options: {
  storage: { url: string };
  configuration: import('../../configuration/policy.js').BillingConfiguration;
  environment: NodeJS.ProcessEnv;
}): Promise<BillingProvider> {
  const bindings = readConfigurationFile(options.environment, 'AUTUMN_CONFIG_FILE');
  if (!options.environment.AUTUMN_SECRET_KEY?.trim()) throw new BillingError('invalid_configuration');
  const parsed = bindingSchema.safeParse(bindings);
  if (!parsed.success) throw new BillingError('invalid_configuration');
  const provider = await AutumnBillingProvider.open(options.storage, {
    secretKey: options.environment.AUTUMN_SECRET_KEY,
    bindings: parsed.data,
    serverURL: options.environment.AUTUMN_SERVER_URL,
    timeoutMs:
      options.environment.AUTUMN_TIMEOUT_MS === undefined ? undefined : Number(options.environment.AUTUMN_TIMEOUT_MS),
  });
  try {
    for (const meter of options.configuration.billingKeys.meters) provider.bindUsage(meter.key);
    return provider;
  } catch (error) {
    provider.close();
    throw error;
  }
}
