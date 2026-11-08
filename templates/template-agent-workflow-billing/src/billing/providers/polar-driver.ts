import { commercialCatalogSchema, resolveAllowance } from '../catalog.js';
import { freezeConfiguration } from '../configuration.js';
import type { CommercialCatalog } from '../catalog.js';
import { createHash } from 'node:crypto';
import { webhooks } from '@polar-sh/sdk/2026-10';
import { z } from 'zod';
import {
  BillingError,
  accountSchema,
  identifierSchema,
  quantitySchema,
  timestampSchema,
  organizationProfileSchema,
  parseInput,
  usageEventSchema,
} from '../contracts.js';
import type {
  CheckoutRequest,
  CommercialSnapshot,
  PreparedHostedSession,
  PortalRequest,
  ProviderAccount,
  ProviderCapabilities,
  UsageDelivery,
  UsageEvent,
  UsageBinding,
  RawWebhookRequest,
  ProviderNotification,
} from '../contracts.js';
import type { BillingDriver, ExternalAccount, DriverObservation } from '../driver.js';
import {
  billingContactSchema,
  customerSchema,
  grantSchema,
  orderSchema,
  polarConfigurationSchema,
  polarBindingsSchema,
  polarCatalogConfigurationSchema,
  productSchema,
  sessionUrlSchema,
  stateSchema,
  subscriptionSchema,
} from './polar-contract.js';
import type { BillingContactResolver, PolarBindings } from './polar-contract.js';

const opaqueId = (value: string) => createHash('sha256').update(value).digest('hex');

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

const polarUsageBindingSchema = z.strictObject({
  server: polarConfigurationSchema.shape.server,
  organizationId: z.uuid(),
  eventName: z.string().min(1).max(128),
  unitsField: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/)
    .refine(value => !['execution_id', 'policy_version', 'resourceId', 'resourceKind'].includes(value)),
});

const usageDeliveryClaimSchema = z
  .strictObject({
    version: z.literal(1),
    event: usageEventSchema,
    request: z.strictObject({
      events: z.tuple([
        z.strictObject({
          name: z.string().min(1).max(128),
          external_id: identifierSchema,
          external_customer_id: accountSchema.shape.externalReference,
          timestamp: timestampSchema,
          metadata: z.record(
            z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/),
            z.union([z.string().max(128), quantitySchema]),
          ),
        }),
      ]),
    }),
  })
  .superRefine((claim, context) => {
    const wire = claim.request.events[0];
    const expected = {
      execution_id: claim.event.executionId,
      policy_version: claim.event.policyVersion,
      ...claim.event.metadata,
    };
    const unitFields = Object.keys(wire.metadata).filter(key => !Object.hasOwn(expected, key));
    if (
      wire.external_id !== claim.event.id ||
      wire.external_customer_id !== claim.event.account.externalReference ||
      wire.timestamp !== claim.event.occurredAt ||
      Object.entries(expected).some(([key, value]) => wire.metadata[key] !== value) ||
      unitFields.length !== 1 ||
      wire.metadata[unitFields[0]] !== claim.event.units
    )
      context.addIssue({ code: 'custom', message: 'Usage delivery must preserve its logical event.' });
  });

class WireError extends Error {
  constructor(readonly status: number) {
    super('Polar request failed.');
  }
}
export class PolarBillingDriver implements BillingDriver {
  readonly id = 'polar';
  readonly legacySourceKeys = true;
  readonly capabilities = polarCapabilities;
  readonly configuration: PolarBindings;
  get publicBindings() {
    return JSON.stringify(this.configuration);
  }
  constructor(
    configuration: unknown,
    private readonly catalog: CommercialCatalog,
    private readonly token: string,
    private readonly contact: BillingContactResolver,
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
    this.catalog = catalogTerms.data;
    this.configuration = parsed.data;
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
  private async request<T>(path: string, schema: z.ZodType<T>, body?: unknown): Promise<T> {
    const response = await fetch(`${this.configuration.server.replace(/\/$/, '')}/v1${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Polar-Version': '2026-10',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.headers.get('Polar-Version') !== '2026-10') throw new BillingError('state_unavailable');
    if (!response.ok) {
      await response.body?.cancel();
      throw new WireError(response.status);
    }
    const text = await response.text();
    if (Buffer.byteLength(text) > 4 * 1024 * 1024) throw new BillingError('state_unavailable');
    const parsed = schema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new BillingError('state_unavailable');
    return parsed.data;
  }
  private async list<T extends { id: string }>(path: string, schema: z.ZodType<T>, customerId: string): Promise<T[]> {
    const result: T[] = [];
    let count: number | undefined;
    let pages: number | undefined;
    for (let page = 1; page <= 100; page++) {
      const data = await this.request(
        `${path}?customer_id=${encodeURIComponent(customerId)}&page=${page}&limit=100`,
        z.object({
          items: z.array(schema).max(100),
          pagination: z.object({
            total_count: z.number().int().min(0).max(10000),
            max_page: z.number().int().min(0).max(100),
          }),
        }),
      );
      count ??= data.pagination.total_count;
      pages ??= data.pagination.max_page;
      if (count !== data.pagination.total_count || pages !== data.pagination.max_page || (count > 0 && pages === 0))
        throw new BillingError('state_unavailable');
      result.push(...data.items);
      if (page >= pages) {
        if (result.length !== count || new Set(result.map(value => value.id)).size !== result.length)
          throw new BillingError('state_unavailable');
        return result;
      }
    }
    throw new BillingError('state_unavailable');
  }
  private customer<T extends z.infer<typeof customerSchema>>(value: T, workspaceId: string) {
    if (
      value.external_id !== `workspace:${workspaceId}` ||
      value.organization_id !== this.configuration.organizationId ||
      value.deleted_at !== null
    )
      throw new BillingError('conflict');
    return value;
  }
  async ensureAccount(input: { workspaceId: string }): Promise<ExternalAccount> {
    const profile = parseInput(organizationProfileSchema, input);
    const path = `/customers/external/${encodeURIComponent(`workspace:${profile.workspaceId}`)}`;
    try {
      let customer;
      try {
        customer = await this.request(path, customerSchema);
      } catch (error) {
        if (!(error instanceof WireError) || error.status !== 404) throw error;
        const contact = parseInput(billingContactSchema, await this.contact(profile.workspaceId));
        try {
          customer = await this.request('/customers/', customerSchema, {
            ...contact,
            external_id: `workspace:${profile.workspaceId}`,
            type: 'individual',
          });
        } catch {
          // Creation has no assumed write-idempotency. Resolve the immutable
          // external ID after conflicts or lost responses, never blindly retry.
          customer = await this.request(path, customerSchema);
        }
      }
      this.customer(customer, profile.workspaceId);
      return {
        customerId: customer.id,
        organizationId: customer.organization_id,
        externalReference: customer.external_id!,
      };
    } catch (error) {
      if (error instanceof BillingError && ['conflict', 'invalid_input'].includes(error.code)) throw error;
      throw new BillingError('state_unavailable');
    }
  }

  async observe(account: ProviderAccount, observation: ExternalAccount): Promise<DriverObservation> {
    account = parseInput(accountSchema, account);
    if (account.provider !== 'polar' || observation.organizationId !== this.configuration.organizationId)
      throw new BillingError('conflict');
    try {
      const state = this.customer(
        await this.request(`/customers/${observation.customerId}/state`, stateSchema),
        account.workspaceId,
      );
      if (state.id !== observation.customerId) throw new BillingError('state_unavailable');
      const grants = await this.list('/benefit-grants/', grantSchema, state.id);
      const subscriptions = await this.list('/subscriptions/', subscriptionSchema, state.id);
      const orders = await this.list('/orders/', orderSchema, state.id);
      if ([...grants, ...subscriptions, ...orders].some(value => value.customer_id !== state.id))
        throw new BillingError('state_unavailable');
      const productIds = [
        ...new Set([
          ...this.configuration.grants.map(value => value.productId),
          ...this.configuration.subscriptions.map(value => value.productId),
          ...this.configuration.meters.flatMap(value => (value.productId ? [value.productId] : [])),
        ]),
      ];
      const products = new Map<string, z.infer<typeof productSchema>>();
      for (const id of productIds) {
        const product = await this.request(`/products/${id}`, productSchema);
        if (product.id !== id || product.organization_id !== this.configuration.organizationId || product.is_archived)
          throw new BillingError('state_unavailable');
        products.set(id, product);
      }
      const relevantBenefits = new Set([
        ...this.configuration.entitlements.map(value => value.benefitId),
        ...this.configuration.grants.map(value => value.benefitId),
      ]);
      for (const grant of grants.filter(value => relevantBenefits.has(value.benefit_id))) {
        if (
          grant.benefit.id !== grant.benefit_id ||
          grant.benefit.organization_id !== this.configuration.organizationId ||
          grant.benefit.is_deleted ||
          (grant.is_granted &&
            (grant.is_revoked || grant.revoked_at != null || grant.granted_at == null || grant.error))
        )
          throw new BillingError('state_unavailable');
      }
      const activeGrants = grants.filter(
        grant => grant.is_granted && !grant.is_revoked && grant.granted_at != null && !grant.error,
      );
      for (const grant of activeGrants)
        if (!state.granted_benefits.some(value => value.id === grant.id && value.benefit_id === grant.benefit_id))
          throw new BillingError('state_unavailable');
      const now = Date.now();
      const activeSubscriptions = subscriptions.filter(
        subscription =>
          subscription.status === 'active' &&
          Date.parse(subscription.current_period_start) <= now &&
          Date.parse(subscription.current_period_end) > now,
      );
      for (const subscription of activeSubscriptions)
        if (
          !state.active_subscriptions.some(
            value =>
              value.id === subscription.id &&
              value.product_id === subscription.product_id &&
              value.status === 'active' &&
              value.current_period_start === subscription.current_period_start &&
              value.current_period_end === subscription.current_period_end,
          )
        )
          throw new BillingError('state_unavailable');
      const sources: DriverObservation['sources'] = [];
      for (const binding of this.configuration.grants) {
        const allowance = resolveAllowance(this.catalog, binding.allowance);
        if (!allowance) throw new BillingError('invalid_configuration');
        const mapping = { ...binding, ...allowance };
        const product = products.get(mapping.productId)!;
        const benefit = product.benefits.find(value => value.id === mapping.benefitId);
        const price = product.prices.find(value => value.id === mapping.priceId && !value.is_archived);
        if (
          !benefit ||
          benefit.type !== 'meter_credit' ||
          benefit.is_deleted ||
          benefit.organization_id !== this.configuration.organizationId ||
          benefit.properties.units !== mapping.units ||
          benefit.properties.meter_id !== mapping.meterId ||
          benefit.properties.rollover !== false ||
          !price ||
          price.amount_type !== 'fixed' ||
          product.prices.some(value => value.amount_type.startsWith('metered')) ||
          product.is_recurring !== (mapping.kind === 'subscription')
        )
          throw new BillingError('state_unavailable');
        for (const grant of grants.filter(value => value.benefit_id === mapping.benefitId)) {
          if (
            grant.benefit.id !== benefit.id ||
            grant.benefit.type !== benefit.type ||
            grant.benefit.is_deleted ||
            grant.benefit.properties.units !== mapping.units ||
            grant.benefit.properties.meter_id !== mapping.meterId ||
            grant.benefit.properties.rollover !== false ||
            grant.is_granted === grant.is_revoked ||
            (grant.is_granted && (grant.granted_at == null || grant.revoked_at != null || grant.error))
          )
            throw new BillingError('state_unavailable');
          let sourceId: string, validFrom: string, validUntil: string | null, active: boolean;
          if (mapping.kind === 'order') {
            if (grant.order_id === null || grant.subscription_id !== null) continue;
            const order = orders.find(value => value.id === grant.order_id);
            if (!order || order.product_id !== mapping.productId || order.subscription_id !== null)
              throw new BillingError('state_unavailable');
            if (
              order.items.some(value => value.proration) ||
              !order.items.some(value => value.product_price_id === mapping.priceId)
            )
              throw new BillingError('state_unavailable');
            sourceId = order.id;
            validFrom = order.created_at;
            validUntil =
              mapping.expiry.type === 'duration'
                ? new Date(Date.parse(validFrom) + mapping.expiry.milliseconds).toISOString()
                : null;
            active =
              order.paid &&
              order.status === 'paid' &&
              order.refunded_amount === 0 &&
              order.refunded_tax_amount === 0 &&
              order.billing_reason === 'purchase';
          } else {
            if (grant.subscription_id === null) continue;
            const subscription = subscriptions.find(value => value.id === grant.subscription_id);
            if (!subscription || subscription.product_id !== mapping.productId)
              throw new BillingError('state_unavailable');
            if (
              subscription.pending_update !== null ||
              subscription.prices.length !== 1 ||
              subscription.prices[0].id !== mapping.priceId ||
              ((subscription.current_meter_period_start !== null || subscription.current_meter_period_end !== null) &&
                (subscription.current_meter_period_start !== subscription.current_period_start ||
                  subscription.current_meter_period_end !== subscription.current_period_end)) ||
              (product.meter_interval !== null &&
                (product.meter_interval !== product.recurring_interval ||
                  product.meter_interval_count !== product.recurring_interval_count))
            )
              throw new BillingError('state_unavailable');
            sourceId = subscription.id;
            validFrom = subscription.current_period_start;
            validUntil = subscription.current_period_end;
            active = activeSubscriptions.some(value => value.id === subscription.id);
          }
          const identity = {
            kind: mapping.kind,
            sourceId,
            benefitId: mapping.benefitId,
            periodStart: mapping.kind === 'subscription' ? validFrom : null,
          };
          const provenance = JSON.stringify({
            ...identity,
            meter: mapping.meter,
            productId: mapping.productId,
            priceId: mapping.priceId,
            units: mapping.units,
            version: mapping.version,
            expiry: mapping.expiry,
            validFrom,
          });
          sources.push({
            allowance: binding.allowance,
            source: {
              key: opaqueId(JSON.stringify(identity)),
              meter: mapping.meter,
              kind: mapping.kind,
              fingerprint: opaqueId(provenance),
              provenance,
              units: mapping.units,
              validFrom,
              validUntil,
              active: active && grant.is_granted && !grant.is_revoked,
            },
          });
        }
      }
      const entitlements = this.configuration.entitlements.flatMap(mapping => {
        const matches = activeGrants.filter(
          value =>
            value.benefit_id === mapping.benefitId &&
            (value.subscription_id === null ||
              activeSubscriptions.some(subscription => subscription.id === value.subscription_id)),
        );
        if (!matches.length) return [];
        const ends = matches.map(grant =>
          grant.subscription_id === null
            ? null
            : activeSubscriptions.find(subscription => subscription.id === grant.subscription_id)!.current_period_end,
        );
        return [
          {
            key: mapping.key,
            validFrom: matches.map(value => value.granted_at!).sort()[0],
            validUntil: ends.includes(null) ? null : (ends as string[]).sort().at(-1)!,
          },
        ];
      });
      const commercialSubscriptions = this.configuration.subscriptions.flatMap(mapping => {
        const matches = activeSubscriptions.filter(value => value.product_id === mapping.productId);
        return matches.length
          ? [
              {
                key: mapping.key,
                validFrom: matches.map(value => value.current_period_start).sort()[0],
                validUntil: matches
                  .map(value => value.current_period_end)
                  .sort()
                  .at(-1)!,
              },
            ]
          : [];
      });
      const meters: CommercialSnapshot['meters'][number][] = [];
      for (const mapping of this.configuration.meters) {
        if (mapping.funding === 'prepaid') {
          const current = sources
            .map(value => value.source)
            .filter(
              source =>
                source.meter === mapping.key &&
                source.active &&
                Date.parse(source.validFrom) <= now &&
                (source.validUntil === null || Date.parse(source.validUntil) > now),
            );
          if (current.length)
            meters.push({
              key: mapping.key,
              funding: 'prepaid',
              confirmedBalance: 0,
              consumedUnits: 0,
              periodStart: current.some(source => source.validUntil === null)
                ? null
                : current
                    .map(source => source.validFrom)
                    .sort((left, right) => Date.parse(left) - Date.parse(right))[0],
              periodEnd: current.some(source => source.validUntil === null)
                ? null
                : current
                    .map(source => source.validUntil!)
                    .sort((left, right) => Date.parse(left) - Date.parse(right))
                    .at(-1)!,
            });
        } else {
          const product = products.get(mapping.productId!)!;
          const price = product.prices.find(value => value.id === mapping.priceId);
          if (
            !product.is_recurring ||
            !price ||
            !price.amount_type.startsWith('metered') ||
            price.meter_id !== mapping.meterId ||
            price.is_archived
          )
            throw new BillingError('state_unavailable');
          const current = activeSubscriptions.filter(
            value =>
              value.product_id === product.id &&
              value.pending_update === null &&
              value.prices.some(price => price.id === mapping.priceId && price.meter_id === mapping.meterId),
          );
          if (current.length)
            meters.push({
              key: mapping.key,
              funding: 'metered',
              confirmedBalance: null,
              consumedUnits: 0,
              periodStart: current.map(value => value.current_period_start).sort()[0],
              periodEnd: current
                .map(value => value.current_period_end)
                .sort()
                .at(-1)!,
            });
        }
      }
      return {
        account: observation,
        sources,
        commercial: { entitlements, subscriptions: commercialSubscriptions, meters },
      };
    } catch {
      throw new BillingError('state_unavailable');
    }
  }

  bindUsage(meter: string): UsageBinding {
    const mapping = this.configuration.meters.find(value => value.key === meter);
    if (!mapping) throw new BillingError('invalid_input');
    const data = parseInput(polarUsageBindingSchema, {
      server: this.configuration.server,
      organizationId: this.configuration.organizationId,
      eventName: mapping.eventName,
      unitsField: mapping.unitsField,
    });
    return { provider: this.id, meter, version: 1, data: JSON.stringify(data) };
  }

  private usageMapping(binding: UsageBinding) {
    if (binding.provider !== this.id || binding.version !== 1) throw new BillingError('storage_incompatible');
    const mapping = parseInput(polarUsageBindingSchema, JSON.parse(binding.data));
    if (mapping.server !== this.configuration.server || mapping.organizationId !== this.configuration.organizationId)
      throw new BillingError('state_unavailable');
    return mapping;
  }
  normalizeUsage(input: UsageEvent, binding: UsageBinding): string {
    const event = parseInput(usageEventSchema, input);
    const mapping = this.usageMapping(binding);
    return JSON.stringify(
      usageDeliveryClaimSchema.parse({
        version: 1,
        event,
        request: {
          events: [
            {
              name: mapping.eventName,
              external_id: event.id,
              external_customer_id: event.account.externalReference,
              timestamp: event.occurredAt,
              metadata: {
                [mapping.unitsField]: event.units,
                execution_id: event.executionId,
                policy_version: event.policyVersion,
                ...Object.fromEntries(Object.entries(event.metadata).filter(([, value]) => value !== undefined)),
              },
            },
          ],
        },
      }),
    );
  }
  validateUsage(payload: string, input: UsageEvent, binding: UsageBinding | null): void {
    const event = parseInput(usageEventSchema, input);
    const claim = usageDeliveryClaimSchema.safeParse(JSON.parse(payload));
    if (!claim.success) throw new BillingError('storage_incompatible');
    if (JSON.stringify(claim.data.event) !== JSON.stringify(event)) throw new BillingError('conflict');
    if (binding) {
      const mapping = this.usageMapping(binding);
      const wire = claim.data.request.events[0];
      if (wire.name !== mapping.eventName || wire.metadata[mapping.unitsField] !== event.units)
        throw new BillingError('conflict');
    }
  }
  async sendUsage(payload: string): Promise<UsageDelivery> {
    const claim = usageDeliveryClaimSchema.parse(JSON.parse(payload));
    try {
      const result = await this.request(
        '/events/ingest',
        z
          .object({
            inserted: z.number().int().min(0).max(1),
            duplicates: z.number().int().min(0).max(1).default(0),
          })
          .refine(value => value.inserted + value.duplicates === 1),
        claim.request,
      );
      return { status: result.duplicates === 1 ? 'duplicate' : 'accepted', eventId: claim.event.id };
    } catch (error) {
      return error instanceof WireError &&
        error.status >= 400 &&
        error.status < 500 &&
        ![408, 409, 429].includes(error.status)
        ? { status: 'permanent_failure', code: 'polar_rejected' }
        : { status: 'uncertain', code: 'polar_unavailable' };
    }
  }

  async prepareCheckout(request: CheckoutRequest, link: ExternalAccount): Promise<PreparedHostedSession> {
    const product = this.configuration.products.find(value => value.key === request.product);
    const offer = product
      ? this.catalog.offers.find(value => value.key === product.key && value.version === product.version)
      : undefined;
    if (!product || !offer || !this.configuration.returnUrls.includes(request.returnUrl))
      throw new BillingError('invalid_input');
    const returnUrl = request.returnUrl;
    const productId = product.productId;
    const { customerId } = link;
    try {
      const verifiedProduct = await this.request(`/products/${productId}`, productSchema);
      if (
        verifiedProduct.id !== productId ||
        verifiedProduct.organization_id !== this.configuration.organizationId ||
        verifiedProduct.is_archived ||
        offer.entitlements.some(
          key =>
            !verifiedProduct.benefits.some(
              benefit =>
                benefit.id === this.configuration.entitlements.find(value => value.key === key)?.benefitId &&
                !benefit.is_deleted,
            ),
        )
      )
        throw new BillingError('state_unavailable');
    } catch {
      throw new BillingError('state_unavailable');
    }
    return {
      status: 'prepared',
      dispatch: async () => {
        try {
          const result = await this.request(
            '/checkouts/',
            z.object({
              url: sessionUrlSchema,
              customer_id: z.uuid(),
              product_id: z.uuid(),
              return_url: z.url(),
              success_url: z.url(),
            }),
            {
              products: [productId],
              customer_id: customerId,
              success_url: returnUrl,
              return_url: returnUrl,
            },
          );
          if (
            result.customer_id !== customerId ||
            result.product_id !== productId ||
            result.return_url !== returnUrl ||
            result.success_url !== returnUrl
          )
            throw new BillingError('state_unavailable');
          return { status: 'created', url: result.url };
        } catch {
          throw new BillingError('state_unavailable');
        }
      },
    };
  }
  async preparePortalSession(request: PortalRequest, link: ExternalAccount): Promise<PreparedHostedSession> {
    if (!this.configuration.returnUrls.includes(request.returnUrl)) throw new BillingError('invalid_input');
    const returnUrl = request.returnUrl;
    const { customerId } = link;
    return {
      status: 'prepared',
      dispatch: async () => {
        try {
          const result = await this.request(
            '/customer-sessions/',
            z.object({ customer_id: z.uuid(), customer_portal_url: sessionUrlSchema }),
            { customer_id: customerId, return_url: returnUrl },
          );
          if (result.customer_id !== customerId) throw new BillingError('state_unavailable');
          return { status: 'created', url: result.customer_portal_url };
        } catch {
          throw new BillingError('state_unavailable');
        }
      },
    };
  }
  async verifyWebhook(request: RawWebhookRequest): Promise<ProviderNotification> {
    if (!this.webhookSecret) throw new BillingError('unsupported');
    const headers = Object.fromEntries(
      Object.entries(request.headers).map(([key, value]) => [key.toLowerCase(), value]),
    );
    // SDK verification receives the original bytes. Reject malformed UTF-8 so
    // decoding cannot turn different byte sequences into the same signed text.
    let payload: unknown;
    let unknown = false;
    try {
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(request.body);
      if (!Buffer.from(new TextEncoder().encode(decoded)).equals(Buffer.from(request.body)))
        throw new BillingError('unauthenticated');
      payload = await webhooks.validateEvent(request.body, { ...request.headers }, this.webhookSecret);
    } catch (error) {
      // The pinned SDK throws UnknownType only after authenticating the body.
      if (error instanceof webhooks.PolarWebhookUnknownTypeError) unknown = true;
      else throw new BillingError('unauthenticated');
    }
    if (headers['webhook-api-version'] !== '2026-10') throw new BillingError('invalid_input');
    if (unknown) {
      try {
        payload = JSON.parse(new TextDecoder().decode(request.body));
      } catch {
        throw new BillingError('invalid_input');
      }
    }
    const envelope = parseInput(
      z.object({
        api_version: z.literal('2026-10'),
        type: z.string().min(1).max(128),
        timestamp: timestampSchema,
        data: z.record(z.string(), z.unknown()),
      }),
      payload,
    );
    const relevant = !unknown && /^(customer|order|subscription|benefit_grant)\./.test(envelope.type);
    const data = envelope.data;
    const customer =
      typeof data.customer === 'object' && data.customer !== null
        ? (data.customer as Record<string, unknown>)
        : undefined;
    const reference = relevant
      ? envelope.type.startsWith('customer.')
        ? data.id
        : (data.customer_id ?? customer?.id)
      : null;
    const accountReference = parseInput(z.string().min(1).max(256).nullable(), reference ?? null);
    if (relevant && accountReference === null) throw new BillingError('invalid_input');
    return {
      status: 'verified',
      id: parseInput(identifierSchema, headers['webhook-id']),
      type: envelope.type,
      accountReference,
      occurredAt: envelope.timestamp,
      digest: createHash('sha256').update(request.body).digest('hex'),
    };
  }
}
