import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { BillingError, identifierSchema, parseInput } from './contracts.js';
import type { BillingProvider, CommercialSnapshot } from './contracts.js';
import { parseBillingConfiguration } from './configuration.js';
import {
  eligible,
  executionRequestSchema,
  fingerprint,
  needsCommercialState,
  outcomeSchema,
  reservation,
  snapshotSchema,
} from './accounting.js';
import type { BillingResponse, BoundedExecutor } from './accounting.js';
import { OrganizationService } from './organizations.js';
import type { BillingContext } from './organizations.js';
import { AccountingStorage } from './storage/accounting.js';

const runtimeId = randomUUID();

export class BillingGateway {
  private readonly configuration;
  private readonly executors = new Map<string, BoundedExecutor>();
  constructor(
    private readonly organizations: OrganizationService,
    private readonly storage: AccountingStorage,
    private readonly provider: BillingProvider,
    configuration: unknown,
    executors: readonly BoundedExecutor[],
  ) {
    if (provider.id !== 'local' && organizations.identity.kind !== 'jwt')
      throw new BillingError('invalid_configuration');
    this.configuration = parseBillingConfiguration(configuration, provider.capabilities);
    if (this.configuration.provider !== provider.id) throw new BillingError('invalid_configuration');
    for (const executor of executors) {
      const resource = this.configuration.resources.find(resource => resource.id === executor.resourceId);
      const key = `${executor.resourceId}:${executor.operation}`;
      if (
        ['resume', 'cancel'].includes(executor.operation) ||
        !resource ||
        !resource.operations.includes(executor.operation) ||
        this.executors.has(key) ||
        typeof executor.execute !== 'function'
      )
        throw new BillingError('invalid_configuration');
      const measurements = parseInput(
        z
          .array(
            z.strictObject({
              key: identifierSchema,
              maxUnits: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
              enforceableBound: z.boolean().optional(),
            }),
          )
          .max(100),
        executor.measurements,
      );
      if (
        new Set(measurements.map(measure => measure.key)).size !== measurements.length ||
        measurements.some(measure => !resource.measurements.some(registered => registered.key === measure.key))
      )
        throw new BillingError('invalid_configuration');
      const charge = resource.policy.charge;
      if (
        charge.type === 'usage' &&
        charge.funding === 'prepaid' &&
        measurements.some(measure => measure.key === charge.measure && measure.enforceableBound === false)
      )
        throw new BillingError('invalid_configuration');
      if (
        charge.type === 'usage' &&
        !measurements.some(measure => measure.key === charge.measure && measure.maxUnits <= charge.maxUnits)
      )
        throw new BillingError('invalid_configuration');
      // Capture the function and validated limits now; later caller mutations to
      // registration objects cannot change the admitted executor contract.
      this.executors.set(
        key,
        Object.freeze({
          resourceId: executor.resourceId,
          operation: executor.operation,
          measurements: Object.freeze(measurements),
          execute: executor.execute.bind(executor),
        }),
      );
    }
    for (const resource of this.configuration.resources)
      for (const operation of resource.operations)
        if (!['resume', 'cancel'].includes(operation) && !this.executors.has(`${resource.id}:${operation}`))
          throw new BillingError('invalid_configuration');
  }

  async execute(
    context: BillingContext,
    input: unknown,
    lifecycle?: { executionId: string; version: number; configuration?: ReturnType<BillingGateway['resource']> },
  ): Promise<BillingResponse> {
    const request = parseInput(executionRequestSchema, input);
    const projection = request.input;
    const identity = await this.organizations.accountingIdentity(context);
    const claim = {
      identity,
      runtimeId,
      resourceId: request.resourceId,
      operation: request.operation,
      key: request.idempotencyKey,
      fingerprint: fingerprint(projection),
    };
    const previous = await this.storage.replay(claim);
    if (previous) return previous;
    const resource =
      lifecycle?.configuration ?? this.configuration.resources.find(resource => resource.id === request.resourceId);
    const executor = this.executors.get(`${request.resourceId}:${request.operation}`);
    if (!resource || !executor) throw new BillingError('unsupported');
    for (let attempt = 0; attempt < 3; attempt++) {
      let snapshot: CommercialSnapshot | null = null;
      if (needsCommercialState(resource.policy)) {
        try {
          const account = await this.provider.ensureAccount({ workspaceId: identity.workspaceId });
          if (account.workspaceId !== identity.workspaceId || account.provider !== this.provider.id)
            throw new BillingError('state_unavailable');
          const eventIds = await this.storage.eventIds(account.id);
          // Reconcile state and reflection as one provider observation, avoiding
          // a balance snapshot paired with a later reflection result.
          const reconciliation = await this.provider.reconcile({ account, eventIds });
          if (reconciliation.status !== 'confirmed') throw new BillingError('state_unavailable');
          const parsed = snapshotSchema.safeParse(reconciliation.snapshot);
          const ids = z
            .array(identifierSchema)
            .max(1000)
            .refine(values => new Set(values).size === values.length)
            .safeParse(reconciliation.reflectedEventIds);
          if (
            !parsed.success ||
            !ids.success ||
            ids.data.some(id => !eventIds.includes(id)) ||
            Object.entries(parsed.data.account).some(([key, value]) => account[key as keyof typeof account] !== value)
          )
            throw new BillingError('state_unavailable');
          snapshot = parsed.data;
        } catch {
          throw new BillingError('state_unavailable');
        }
      }
      // Reauthenticate after provider waits. SQL then checks credential activity,
      // token deadline, identity and membership together with the reservation.
      const current = await this.organizations.accountingIdentity(context);
      const admitted = await this.storage.admit(
        { ...claim, identity: current },
        resource,
        snapshot,
        lifecycle?.executionId,
        resource.policy.charge.type === 'none' ? undefined : this.provider.bindUsage(resource.policy.charge.meter),
      );
      if (admitted.status === 'stale') continue;
      if (admitted.status === 'replayed') return admitted.response;
      let outcome;
      let result = null;
      try {
        const charge = resource.policy.charge;
        outcome = parseInput(
          outcomeSchema,
          await executor.execute(
            projection,
            Object.freeze({
              executionId: admitted.executionId,
              maxUnits: charge.type === 'usage' ? reservation(resource.policy) : null,
              measure: charge.type === 'usage' ? charge.measure : null,
            }),
          ),
        );
        if (outcome.result !== undefined) result = outcome.result;
      } catch {
        // A throw or malformed completion cannot prove termination/failure.
        // Preserve the claim and reservation and never dispatch it again.
        outcome = { status: 'uncertain' as const, measurements: [], measurementComplete: false };
      }
      return this.storage.finish(admitted.executionId, outcome, result, lifecycle);
    }
    throw new BillingError('state_unavailable');
  }
  resource(resourceId: string) {
    const resource = this.configuration.resources.find(resource => resource.id === resourceId);
    if (!resource) throw new BillingError('unsupported');
    return resource;
  }

  async revalidate(context: BillingContext, resource: ReturnType<BillingGateway['resource']>) {
    const identity = await this.organizations.accountingIdentity(context);
    let commercial: { accountId: string; revision: string } | undefined;
    if (needsCommercialState(resource.policy)) {
      try {
        const account = await this.provider.ensureAccount({ workspaceId: identity.workspaceId });
        if (account.workspaceId !== identity.workspaceId || account.provider !== this.provider.id)
          throw new BillingError('state_unavailable');
        const result = await this.provider.reconcile({ account, eventIds: await this.storage.eventIds(account.id) });
        if (result.status !== 'confirmed') throw new BillingError('state_unavailable');
        const snapshot = parseInput(snapshotSchema, result.snapshot);
        if (Object.entries(snapshot.account).some(([key, value]) => account[key as keyof typeof account] !== value))
          throw new BillingError('state_unavailable');
        eligible(resource.policy, snapshot, Date.now());
        commercial = { accountId: account.id, revision: snapshot.evidence!.version };
      } catch (error) {
        if (error instanceof BillingError && error.code === 'forbidden') throw error;
        throw new BillingError('state_unavailable');
      }
    }
    return { ...(await this.organizations.accountingIdentity(context)), commercial };
  }

  async read(context: BillingContext, executionId: string): Promise<BillingResponse> {
    return this.storage.read(
      await this.organizations.accountingIdentity(context),
      parseInput(identifierSchema, executionId),
    );
  }
}
