import { createHash } from 'node:crypto';
import { z } from 'zod';
import { resolveAllowance } from '../catalog.js';
import type { CommercialCatalog } from '../catalog.js';
import { BillingError, accountSchema, parseInput } from '../contracts.js';
import type { CommercialSnapshot, ProviderAccount } from '../contracts.js';
import type { DriverObservation, ExternalAccount } from '../driver.js';
import { grantSchema, subscriptionSchema, orderSchema, stateSchema, productSchema } from './polar-contract.js';
import type { PolarBindings } from './polar-contract.js';
import type { PolarAccounts } from './polar-accounts.js';
import type { PolarTransport } from './polar-transport.js';

const opaqueId = (value: string) => createHash('sha256').update(value).digest('hex');
export class PolarObservation {
  constructor(
    private readonly configuration: PolarBindings,
    private readonly catalog: CommercialCatalog,
    private readonly transport: PolarTransport,
    private readonly accounts: PolarAccounts,
  ) {}
  async observe(account: ProviderAccount, observation: ExternalAccount): Promise<DriverObservation> {
    account = parseInput(accountSchema, account);
    if (account.provider !== 'polar' || observation.organizationId !== this.configuration.organizationId)
      throw new BillingError('conflict');
    try {
      const state = this.accounts.customer(
        await this.transport.request(`/customers/${observation.customerId}/state`, stateSchema),
        account.workspaceId,
      );
      if (state.id !== observation.customerId) throw new BillingError('state_unavailable');
      const grants = await this.transport.list('/benefit-grants/', grantSchema, state.id);
      const subscriptions = await this.transport.list('/subscriptions/', subscriptionSchema, state.id);
      const orders = await this.transport.list('/orders/', orderSchema, state.id);
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
        const product = await this.transport.request(`/products/${id}`, productSchema);
        // Archiving stops new sales; verified purchases and active renewals retain access.
        if (product.id !== id || product.organization_id !== this.configuration.organizationId)
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
}
