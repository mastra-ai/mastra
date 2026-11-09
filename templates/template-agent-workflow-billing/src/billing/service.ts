import { createHash } from 'node:crypto';
import { z } from 'zod';
import { commercialCatalogSchema } from './catalog.js';
import type { CommercialCatalog } from './catalog.js';
import {
  BillingError,
  accountSchema,
  identifierSchema,
  organizationProfileSchema,
  parseInput,
  usageBindingSchema,
  usageEventSchema,
} from './contracts.js';
import type {
  BillingProvider,
  CheckoutRequest,
  CommercialGrant,
  CommercialSnapshot,
  HostedSession,
  PortalRequest,
  PreparedHostedSession,
  ProviderAccount,
  RawWebhookRequest,
  ReconciliationRequest,
  UsageEvent,
} from './contracts.js';
import { catalogObservationSchema, externalAccountSchema } from './driver.js';
import type { BillingDriver, DriverObservation } from './driver.js';
import { BillingDatabase } from './storage/database.js';
import { GrantStorage, opaqueId } from './storage/grants.js';
import { retainCatalog, retainedCatalog } from './storage/catalog.js';
import { ProviderLifecycleStorage, requireLiveProvider } from './storage/provider-lifecycle.js';
import { readUsageBinding } from './storage/usage-bindings.js';

interface ServiceResources {
  database: BillingDatabase;
  grants: GrantStorage;
  catalog: CommercialCatalog;
}

// Application-owned financial persistence, independently of external drivers.
export class BillingService implements BillingProvider {
  readonly capabilities;
  private readonly observationSchema;
  private readonly drivers = new Map<string, BillingDriver>();
  protected constructor(
    private readonly resources: ServiceResources,
    readonly id: string,
    drivers: readonly BillingDriver[],
  ) {
    for (const driver of drivers) this.drivers.set(driver.id, driver);
    this.capabilities = this.driver(id).capabilities;
    this.observationSchema = catalogObservationSchema(resources.catalog);
  }
  static async resources(options: {
    url: string;
    catalog: unknown;
    drivers: readonly BillingDriver[];
  }): Promise<ServiceResources> {
    const parsed = commercialCatalogSchema.safeParse(options.catalog);
    if (
      !parsed.success ||
      !options.drivers.length ||
      new Set(options.drivers.map(driver => driver.id)).size !== options.drivers.length
    )
      throw new BillingError('invalid_configuration');
    for (const driver of options.drivers) {
      if (
        !identifierSchema.safeParse(driver.id).success ||
        driver.id === 'local' ||
        (driver.capabilities.prepaid && driver.capabilities.prepaidAuthority !== 'application-ledger') ||
        !z.string().min(1).max(65536).safeParse(driver.publicBindings).success
      )
        throw new BillingError('invalid_configuration');
      try {
        JSON.parse(driver.publicBindings);
      } catch {
        throw new BillingError('invalid_configuration');
      }
    }
    const database = await BillingDatabase.open({ url: options.url });
    let grants: GrantStorage | undefined;
    try {
      await retainCatalog(database, parsed.data);
      await database.write(async tx => {
        for (const driver of options.drivers)
          await tx.execute({
            sql: 'INSERT INTO billing_driver_configurations VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
            args: [driver.id, createHash('sha256').update(driver.publicBindings).digest('hex'), driver.publicBindings],
          });
      });
      grants = await GrantStorage.open({ url: options.url });
      return { database, grants, catalog: await retainedCatalog(database) };
    } catch (error) {
      database.close();
      grants?.close();
      throw error;
    }
  }
  static async connect(options: {
    url: string;
    catalog: unknown;
    activeProvider: string;
    drivers: readonly BillingDriver[];
  }) {
    if (!options.drivers.some(driver => driver.id === options.activeProvider))
      throw new BillingError('invalid_configuration');
    return new BillingService(await this.resources(options), options.activeProvider, options.drivers);
  }
  close() {
    this.resources.grants.close();
    this.resources.database.close();
  }
  private driver(id: string) {
    const driver = this.drivers.get(id);
    if (!driver) throw new BillingError('state_unavailable');
    return driver;
  }
  async ensureAccount(input: { workspaceId: string }): Promise<ProviderAccount> {
    const profile = parseInput(organizationProfileSchema, input);
    const external = parseInput(externalAccountSchema, await this.driver(this.id).ensureAccount(profile));
    if (external.externalReference !== `workspace:${profile.workspaceId}`) throw new BillingError('conflict');
    return this.resources.grants.link(
      profile.workspaceId,
      this.id,
      external,
      Boolean(this.driver(this.id).legacySourceKeys),
    );
  }
  // Trusted server-side operation; deliberately absent from HTTP routes. A caller
  // must name the current provider. Selection alone never migrates purchases.
  async switchProvider(input: {
    workspaceId: string;
    expectedProvider: string;
    evidence?: string;
  }): Promise<ProviderAccount> {
    const request = parseInput(
      z.strictObject({
        workspaceId: identifierSchema,
        expectedProvider: identifierSchema,
        evidence: z.string().trim().min(1).max(2048).optional(),
      }),
      input,
    );
    if (request.expectedProvider === 'local' || this.id === 'local' || request.expectedProvider === this.id)
      throw new BillingError('conflict');
    const external = parseInput(
      externalAccountSchema,
      await this.driver(this.id).ensureAccount({ workspaceId: request.workspaceId }),
    );
    if (external.externalReference !== `workspace:${request.workspaceId}`) throw new BillingError('conflict');
    return this.resources.grants.link(
      request.workspaceId,
      this.id,
      external,
      Boolean(this.driver(this.id).legacySourceKeys),
      request,
    );
  }
  // Operator-only lifecycle change. Closing external sales and renewal channels
  // is an explicit attestation; this method never cancels provider contracts.
  async retireProvider(input: {
    workspaceId: string;
    provider: string;
    evidence: string;
    externalSalesClosed: true;
  }): Promise<void> {
    const request = parseInput(
      z.strictObject({
        workspaceId: identifierSchema,
        provider: identifierSchema,
        evidence: z.string().trim().min(1).max(2048),
        externalSalesClosed: z.literal(true),
      }),
      input,
    );
    const lifecycle = new ProviderLifecycleStorage(this.resources.database);
    const candidate = await lifecycle.candidate(request.workspaceId, this.id, request.provider);
    const driver = this.driver(request.provider);
    if (candidate.sourceKeyMode !== (driver.legacySourceKeys ? 'legacy' : 'namespaced'))
      throw new BillingError('conflict');
    driver.validateAccount(candidate.account, candidate.link);
    let observation: DriverObservation;
    try {
      observation = parseInput(this.observationSchema, await driver.observe(candidate.account, candidate.link));
      if (JSON.stringify(observation.account) !== JSON.stringify(candidate.link)) throw new BillingError('conflict');
    } catch {
      throw new BillingError('state_unavailable');
    }
    await lifecycle.retire(candidate, observation, request.evidence);
  }
  async getState(input: ProviderAccount, synchronization?: { token: string }): Promise<CommercialSnapshot> {
    const account = parseInput(accountSchema, input);
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const lease = await this.resources.grants.beginRefresh(account, synchronization);
        const links = await this.resources.grants.links(account, this.id);
        const observations: (DriverObservation & { provider: string; sourceKeyMode: string })[] = [];
        for (const { provider, sourceKeyMode, ...link } of links) {
          const driver = this.driver(provider);
          if (sourceKeyMode !== (driver.legacySourceKeys ? 'legacy' : 'namespaced')) throw new BillingError('conflict');
          driver.validateAccount({ ...account, provider, externalReference: link.externalReference }, link);
          const observation = parseInput(
            this.observationSchema,
            await driver.observe({ ...account, provider, externalReference: link.externalReference }, link),
          );
          if (JSON.stringify(observation.account) !== JSON.stringify(externalAccountSchema.parse(link)))
            throw new BillingError('conflict');
          observations.push({ provider, sourceKeyMode, ...observation });
        }
        const sources = [];
        const owners = new Map<string, string>();
        for (const observation of observations)
          for (const { source } of observation.sources) {
            // Preserve legacy Polar identities exactly; future providers have their
            // own namespace even when they return the same external source key.
            const key =
              observation.sourceKeyMode === 'legacy'
                ? source.key
                : opaqueId(JSON.stringify([observation.provider, source.key]));
            if (owners.has(key)) throw new BillingError('conflict');
            owners.set(key, observation.provider);
            sources.push({ ...source, key });
          }
        const now = Date.now();
        const active = sources.filter(
          source =>
            source.active &&
            Date.parse(source.validFrom) <= now &&
            (source.validUntil === null || Date.parse(source.validUntil) > now),
        );
        const access = (kind: 'entitlements' | 'subscriptions') => {
          const combined = new Map<string, CommercialGrant>();
          for (const observation of observations)
            for (const grant of observation.commercial[kind]) {
              if (
                Date.parse(grant.validFrom) > now ||
                (grant.validUntil !== null && Date.parse(grant.validUntil) <= now)
              )
                continue;
              const previous = combined.get(grant.key);
              combined.set(
                grant.key,
                previous
                  ? {
                      key: grant.key,
                      validFrom: [previous.validFrom, grant.validFrom].sort((a, b) => Date.parse(a) - Date.parse(b))[0],
                      validUntil:
                        previous.validUntil === null || grant.validUntil === null
                          ? null
                          : [previous.validUntil, grant.validUntil]
                              .sort((a, b) => Date.parse(a) - Date.parse(b))
                              .at(-1)!,
                    }
                  : grant,
              );
            }
          return [...combined.values()];
        };
        const current = observations.find(value => value.provider === account.provider);
        if (!current) throw new BillingError('conflict');
        const meters: CommercialSnapshot['meters'][number][] = current.commercial.meters.filter(
          meter => meter.funding === 'metered',
        );
        for (const key of new Set(active.map(source => source.meter))) {
          if (meters.some(meter => meter.key === key)) throw new BillingError('conflict');
          const current = active.filter(source => source.meter === key);
          const perpetual = current.some(source => source.validUntil === null);
          meters.push({
            key,
            funding: 'prepaid',
            confirmedBalance: 0,
            consumedUnits: 0,
            periodStart: perpetual
              ? null
              : current.map(source => source.validFrom).sort((a, b) => Date.parse(a) - Date.parse(b))[0],
            periodEnd: perpetual
              ? null
              : current
                  .map(source => source.validUntil!)
                  .sort((a, b) => Date.parse(a) - Date.parse(b))
                  .at(-1)!,
          });
        }
        const snapshot = await this.resources.grants.apply(
          account,
          lease.revision,
          sources,
          { entitlements: access('entitlements'), subscriptions: access('subscriptions'), meters },
          lease,
          owners,
        );
        if (snapshot) return snapshot;
      }
    } catch {
      throw new BillingError('state_unavailable');
    }
    throw new BillingError('state_unavailable');
  }
  async reconcile(request: ReconciliationRequest) {
    return { status: 'confirmed' as const, reflectedEventIds: [], snapshot: await this.getState(request.account) };
  }
  bindUsage(meter: string) {
    const binding = parseInput(usageBindingSchema, this.driver(this.id).bindUsage(meter));
    if (binding.provider !== this.id || binding.meter !== meter) throw new BillingError('invalid_configuration');
    return binding;
  }
  async reportUsage(input: UsageEvent) {
    const event = parseInput(usageEventSchema, input);
    const lifecycle = new ProviderLifecycleStorage(this.resources.database);
    const claim = await this.resources.database.write(async tx => {
      const previous = (await tx.execute({ sql: 'SELECT * FROM provider_usage WHERE id = ?', args: [event.id] }))
        .rows[0];
      const binding = await readUsageBinding(tx, event, Boolean(previous));
      if (previous?.account_id !== undefined && previous.account_id !== event.account.id)
        throw new BillingError('conflict');
      const retained = (
        await tx.execute({ sql: 'SELECT payload FROM billing_usage_events WHERE id = ?', args: [event.id] })
      ).rows[0];
      if (retained && String(retained.payload) !== JSON.stringify(event)) throw new BillingError('conflict');
      // Existing outbox/claim bytes identify acknowledgements without requiring
      // a retired driver. Legacy direct calls still need driver validation.
      const outbox = (await tx.execute({ sql: 'SELECT id FROM billing_outbox WHERE id = ?', args: [event.id] }))
        .rows[0];
      if (previous?.delivered === 1n && (retained || outbox)) {
        await lifecycle.recoverAcknowledgedUsage(tx, event.account.id, event.account.provider, event.id);
        return { delivered: true as const, payload: String(previous.payload), effect: null };
      }
      const driver = this.driver(event.account.provider);
      const link = (
        await tx.execute({
          sql: 'SELECT p.*, a.workspace_id FROM billing_provider_links p JOIN billing_accounts a ON a.id = p.account_id WHERE p.account_id = ? AND p.provider = ?',
          args: [event.account.id, event.account.provider],
        })
      ).rows[0];
      if (
        !link ||
        link.workspace_id !== event.account.workspaceId ||
        link.external_reference !== event.account.externalReference
      )
        throw new BillingError('conflict');
      driver.validateAccount(event.account, {
        customerId: String(link.customer_id),
        organizationId: String(link.organization_id),
        externalReference: String(link.external_reference),
      });
      if (previous) {
        const payload = String(previous.payload);
        let stored: unknown;
        try {
          stored = JSON.parse(payload);
        } catch {
          throw new BillingError('storage_incompatible');
        }
        const legacy = usageEventSchema.safeParse(stored);
        if (legacy.success) {
          if (JSON.stringify(legacy.data) !== JSON.stringify(event)) throw new BillingError('conflict');
          if (previous.delivered !== 1n) throw new BillingError('state_unavailable');
          if (binding) driver.normalizeUsage(event, binding);
        } else driver.validateUsage(payload, event, binding);
        if (previous.delivered === 1n) return { delivered: true as const, payload, effect: null };
      }
      await requireLiveProvider(tx, event.account);
      let payload: string;
      if (previous) payload = String(previous.payload);
      else {
        const chosen = binding ?? parseInput(usageBindingSchema, driver.bindUsage(event.meter));
        if (chosen.provider !== event.account.provider || chosen.meter !== event.meter)
          throw new BillingError('conflict');
        payload = driver.normalizeUsage(event, chosen);
        if (Buffer.byteLength(payload) > 65536) throw new BillingError('state_unavailable');
        driver.validateUsage(payload, event, chosen);
      }
      if (!previous)
        await tx.execute({
          sql: 'INSERT INTO provider_usage VALUES (?, ?, ?, 0)',
          args: [event.id, event.account.id, payload],
        });
      if (!retained)
        await tx.execute({
          sql: 'INSERT INTO billing_usage_events VALUES (?, ?)',
          args: [event.id, JSON.stringify(event)],
        });
      const effect = await lifecycle.beginEffectInTransaction(tx, event.account, 'usage', event.id);
      return { delivered: false as const, payload, effect };
    });
    if (claim.delivered) return { status: 'duplicate' as const, eventId: event.id };
    const driver = this.driver(event.account.provider);
    let accepted = false;
    try {
      const result = await driver.sendUsage(claim.payload);
      accepted = result.status === 'accepted' || result.status === 'duplicate';
      if ((result.status === 'accepted' || result.status === 'duplicate') && result.eventId !== event.id) {
        accepted = false;
        throw new BillingError('state_unavailable');
      }
      await this.resources.database.write(async tx => {
        if (accepted)
          await tx.execute({
            sql: 'UPDATE provider_usage SET delivered = 1 WHERE id = ? AND payload = ?',
            args: [event.id, claim.payload],
          });
        await lifecycle.finishEffectInTransaction(tx, claim.effect, accepted);
        if (accepted) await lifecycle.recoverAcknowledgedUsage(tx, event.account.id, event.account.provider, event.id);
      });
      return result;
    } catch (error) {
      await lifecycle.finishEffect(claim.effect, false);
      throw error;
    }
  }
  private fenceHosted(
    account: ProviderAccount,
    kind: 'checkout' | 'portal',
    prepared: PreparedHostedSession,
  ): PreparedHostedSession {
    if (prepared.status !== 'prepared') return prepared;
    const lifecycle = new ProviderLifecycleStorage(this.resources.database);
    return {
      status: 'prepared',
      dispatch: async () => {
        const effect = await lifecycle.beginEffect(
          account,
          kind,
          createHash('sha256').update(JSON.stringify(account)).digest('hex'),
          true,
        );
        try {
          const result = await prepared.dispatch();
          await lifecycle.finishEffect(effect, result.status === 'created');
          return result;
        } catch (error) {
          await lifecycle.finishEffect(effect, false);
          throw error;
        }
      },
    };
  }
  async prepareCheckout(request: CheckoutRequest) {
    request = parseInput(
      z.strictObject({ account: accountSchema, product: identifierSchema, returnUrl: z.url() }),
      request,
    );
    if (request.account.provider !== this.id) throw new BillingError('conflict');
    const link = await this.resources.grants.observation(request.account);
    this.driver(this.id).validateAccount(request.account, link);
    await this.resources.database.write(tx => requireLiveProvider(tx, request.account, true));
    return this.fenceHosted(request.account, 'checkout', await this.driver(this.id).prepareCheckout(request, link));
  }
  async preparePortalSession(request: PortalRequest) {
    request = parseInput(z.object({ account: accountSchema, returnUrl: z.url() }), request);
    if (request.account.provider !== this.id) throw new BillingError('conflict');
    const link = await this.resources.grants.observation(request.account);
    this.driver(this.id).validateAccount(request.account, link);
    await this.resources.database.write(tx => requireLiveProvider(tx, request.account, true));
    return this.fenceHosted(request.account, 'portal', await this.driver(this.id).preparePortalSession(request, link));
  }
  async createCheckout(request: CheckoutRequest): Promise<HostedSession> {
    const prepared = await this.prepareCheckout(request);
    return prepared.status === 'prepared' ? prepared.dispatch() : prepared;
  }
  async createPortalSession(request: PortalRequest): Promise<HostedSession> {
    const prepared = await this.preparePortalSession(request);
    return prepared.status === 'prepared' ? prepared.dispatch() : prepared;
  }
  verifyWebhook(request: RawWebhookRequest, provider = this.id) {
    const driver = this.drivers.get(provider);
    if (!driver?.capabilities.webhooks) throw new BillingError('unsupported');
    return driver.verifyWebhook(request);
  }
}
