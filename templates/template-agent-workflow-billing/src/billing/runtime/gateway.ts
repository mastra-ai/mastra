import { prepaid } from '../contracts/reservations.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { BillingError, identifierSchema, parseInput } from '../contracts/core.js';
import type { BillingProvider } from '../contracts/provider.js';
import type { CommercialSnapshot } from '../contracts/core.js';
import { parseBillingConfiguration } from '../configuration/policy.js';
import {
  eligible,
  executionRequestSchema,
  fingerprint,
  needsCommercialState,
  outcomeSchema,
  reservation,
  snapshotSchema,
} from './accounting.js';
import type { BillingResponse, BoundedExecutor, ResourceConfiguration } from './accounting.js';
import { OrganizationService } from '../organizations.js';
import type { BillingContext } from '../organizations.js';
import { AccountingStorage } from '../storage/accounting.js';

const runtimeId = randomUUID();

export class BillingGateway {
  private readonly resources: ReadonlyMap<string, ResourceConfiguration>;
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
    this.storage.useReservations(provider);
    const parsed = parseBillingConfiguration(configuration, provider.capabilities);
    this.resources = new Map(parsed.resourcePolicies.map(resource => [resource.id, resource]));
    if (parsed.provider !== provider.id) throw new BillingError('invalid_configuration');
    for (const executor of executors) {
      const resource = this.resources.get(executor.resourceId);
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
          inputSchema: executor.inputSchema,
          measurements: Object.freeze(measurements),
          execute: executor.execute.bind(executor),
        }),
      );
    }
    for (const resource of this.resources.values())
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
    const executor = this.executors.get(`${request.resourceId}:${request.operation}`);
    const projection = executor?.inputSchema ? parseInput(executor.inputSchema, request.input) : request.input;
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
    const resource = lifecycle?.configuration ?? this.resources.get(request.resourceId);
    if (!resource || !executor) throw new BillingError('unsupported');
    const executeAdmitted = async (executionId: string) => {
      let outcome;
      let result = null;
      try {
        const charge = resource.policy.charge;
        outcome = parseInput(
          outcomeSchema,
          await executor.execute(
            projection,
            Object.freeze({
              executionId,
              maxUnits: charge.type === 'usage' ? reservation(resource.policy) : null,
              measure: charge.type === 'usage' ? charge.measure : null,
            }),
          ),
        );
        result = outcome.result ?? null;
      } catch {
        // A throw or malformed completion cannot prove termination; never dispatch it again.
        outcome = { status: 'uncertain' as const, measurements: [], measurementComplete: false };
      }
      return this.storage.finish(executionId, outcome, result, lifecycle);
    };
    if (this.provider.reservations && prepaid(resource.policy)) {
      const admission = await this.storage.claimReservation(claim, resource, lifecycle);
      if (admission.status === 'replayed') return admission.response;
      if (admission.status !== 'admitted') throw new BillingError('state_unavailable');
      const id = admission.executionId;
      try {
        const account = await this.provider.ensureAccount({ workspaceId: identity.workspaceId });
        const snapshot = parseInput(snapshotSchema, await this.provider.getState(account));
        if (
          account.provider !== this.provider.id ||
          account.workspaceId !== identity.workspaceId ||
          Object.entries(snapshot.account).some(([key, value]) => account[key as keyof typeof account] !== value)
        )
          throw new BillingError('state_unavailable');
        const current = await this.organizations.accountingIdentity(context);
        const reserved = await this.storage.reserve(id, current, snapshot, lifecycle);
        if (!reserved) {
          const state = await this.storage.read(current, id);
          if (state.billing.executionStatus === 'failed' && state.billing.settlementStatus === 'released')
            throw new BillingError('insufficient_credits');
          return state;
        }
        await this.storage.beginSegment(await this.organizations.accountingIdentity(context), id, lifecycle?.version);
      } catch (error) {
        const released = await this.storage.releaseAdmission(id, lifecycle);
        if (!released) await this.storage.uncertainAdmission(id);
        if (
          error instanceof BillingError &&
          ['forbidden', 'unauthenticated', 'insufficient_credits'].includes(error.code)
        )
          throw error;
        return this.storage.read(await this.organizations.accountingIdentity(context), id);
      }
      return executeAdmitted(id);
    }
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
        lifecycle,
        resource.policy.charge.type === 'none' ? undefined : this.provider.bindUsage(resource.policy.charge.meter),
      );
      if (admitted.status === 'stale') continue;
      if (admitted.status === 'replayed') return admitted.response;
      return executeAdmitted(admitted.executionId);
    }
    throw new BillingError('state_unavailable');
  }
  resource(resourceId: string) {
    const resource = this.resources.get(resourceId);
    if (!resource) throw new BillingError('unsupported');
    return resource;
  }

  async revalidate(context: BillingContext, resource: ReturnType<BillingGateway['resource']>, executionId: string) {
    const identity = await this.organizations.accountingIdentity(context);
    if (this.provider.reservations && prepaid(resource.policy))
      await this.storage.validateReservationBinding(identity, executionId);
    let commercial: { accountId: string; revision: string } | undefined;
    if (needsCommercialState(resource.policy)) {
      try {
        const charge = resource.policy.charge;
        const metered = (charge.type === 'per-task' || charge.type === 'usage') && charge.funding === 'metered';
        const account =
          metered || (prepaid(resource.policy) && this.provider.reservations)
            ? await this.storage.admittedAccount(identity, executionId)
            : await this.provider.ensureAccount({ workspaceId: identity.workspaceId });
        if (account.workspaceId !== identity.workspaceId || (!metered && account.provider !== this.provider.id))
          throw new BillingError('state_unavailable');
        const result = await this.provider.reconcile({ account, eventIds: await this.storage.eventIds(account.id) });
        if (result.status !== 'confirmed') throw new BillingError('state_unavailable');
        const snapshot = parseInput(snapshotSchema, result.snapshot);
        if (Object.entries(snapshot.account).some(([key, value]) => account[key as keyof typeof account] !== value))
          throw new BillingError('state_unavailable');
        eligible(resource.policy, snapshot, Date.now());
        commercial =
          snapshot.prepaidAuthority === 'provider-reservations'
            ? undefined
            : { accountId: account.id, revision: snapshot.evidence!.version };
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
