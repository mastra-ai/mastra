import { z } from 'zod';

import { DomainError } from '../domain/errors.js';
import type { OperationalStore } from '../db/operational-store.js';
import {
  claimProviderEffect,
  finishProviderEffect,
  hasObservedWorkosSessionRevocation,
  readProviderEffectState,
  reconcileProviderEffect,
  type ProviderEffectBinding,
} from '../db/provider-effect-operations.js';
import { armExpectedWorkosMembershipCallback } from '../db/workos-expected-callback-operations.js';
import { opaqueId, utcTimestamp } from '../schemas/common.js';

const approvalContextSchema = z
  .object({
    approvalId: opaqueId,
    fenceToken: z.string().min(1),
    deadline: utcTimestamp,
  })
  .strict();
const roleSchema = z.string().trim().min(1).max(128);
const effectBindingSchema = z
  .object({
    incidentId: opaqueId,
    planId: opaqueId,
    actionId: opaqueId,
    targetId: opaqueId,
    idempotencyKey: z.string().min(1).max(256),
  })
  .strict();

export const IdentityUserSchema = z
  .object({
    id: opaqueId,
    tenantId: opaqueId,
    status: z.enum(['active', 'inactive', 'unknown']),
    createdAt: utcTimestamp.optional(),
  })
  .strict();
export const IdentitySessionSchema = z
  .object({
    id: opaqueId,
    userId: opaqueId,
    status: z.enum(['active', 'revoked', 'expired', 'unknown']),
    createdAt: utcTimestamp.optional(),
    revokedAt: utcTimestamp.optional(),
  })
  .strict();
export const IdentityMembershipSchema = z
  .object({
    id: opaqueId,
    userId: opaqueId,
    roleSlug: roleSchema,
    // Local fixtures may omit this field, but the WorkOS adapter below never
    // treats an omitted/unknown remote membership as active.
    status: z.literal('active').optional(),
    updatedAt: utcTimestamp.optional(),
  })
  .strict();

export type IdentityUser = z.infer<typeof IdentityUserSchema>;
export type IdentitySession = z.infer<typeof IdentitySessionSchema>;
export type IdentityMembership = z.infer<typeof IdentityMembershipSchema>;
export type ApprovalContext = z.infer<typeof approvalContextSchema>;
export type IdentityEffectBinding = z.infer<typeof effectBindingSchema>;
export type IdentityMutationAuthorizer = (
  input: Readonly<{
    operation: 'revoke_session' | 'restore_previous_role';
    approvalContext: ApprovalContext;
    tenantId: string;
    userId: string;
    effect: IdentityEffectBinding;
  }>,
) => Promise<boolean> | boolean;

/** Domain boundary: runtime AuthKit credentials are never used as identity effects. */
export interface IdentityProvider {
  getUser(input: Readonly<{ tenantId: string; userId: string }>): Promise<IdentityUser>;
  listSessions(input: Readonly<{ tenantId: string; userId: string }>): Promise<readonly IdentitySession[]>;
  revokeSession(
    input: Readonly<{
      tenantId: string;
      userId: string;
      sessionId: string;
      approvalContext: ApprovalContext;
      effect?: IdentityEffectBinding;
    }>,
  ): Promise<IdentitySession>;
  restoreRole(
    input: Readonly<{
      tenantId: string;
      userId: string;
      membershipId: string;
      expectedCurrentRole: string;
      previousRole: string;
      approvalContext: ApprovalContext;
      effect?: IdentityEffectBinding;
    }>,
  ): Promise<IdentityMembership>;
}

export type WorkOsIdentityClient = Readonly<{
  userManagement: Readonly<{
    getUser(userId: string): Promise<unknown>;
    listOrganizationMemberships(
      input: Readonly<{
        userId: string;
        organizationId: string;
        statuses: readonly ['active'];
      }>,
    ): Promise<unknown>;
    listSessions(input: Readonly<{ userId: string }>): Promise<unknown>;
    revokeSession(sessionId: string): Promise<unknown>;
  }>;
  organizations: Readonly<{
    getMembership(membershipId: string): Promise<unknown>;
    updateMembership(membershipId: string, input: Readonly<{ roleSlug: string }>): Promise<unknown>;
  }>;
}>;

export class WorkOsIdentityProvider implements IdentityProvider {
  constructor(
    private readonly options: Readonly<{
      client: WorkOsIdentityClient;
      organizationId: string;
      allowedUserIds: ReadonlySet<string>;
      allowedRoleSlugs: ReadonlySet<string>;
      authorizeMutation?: IdentityMutationAuthorizer;
      store?: OperationalStore;
      openStore?: () => OperationalStore;
      timeoutMs?: number;
      now?: () => number;
    }>,
  ) {}

  async getUser(input: Readonly<{ tenantId: string; userId: string }>): Promise<IdentityUser> {
    await this.assertUser(input.tenantId, input.userId);
    return parseUser(
      await this.call(this.options.client.userManagement.getUser(input.userId)),
      input.tenantId,
      input.userId,
    );
  }

  async listSessions(input: Readonly<{ tenantId: string; userId: string }>): Promise<readonly IdentitySession[]> {
    await this.assertUser(input.tenantId, input.userId);
    const response = await this.call(this.options.client.userManagement.listSessions({ userId: input.userId }));
    const sessions = Array.isArray(response) ? response : object(response).data;
    if (!Array.isArray(sessions)) throw new DomainError('VALIDATION_FAILED');
    return Object.freeze(
      sessions
        .filter(session => object(session).organizationId === this.options.organizationId)
        .map(session => parseSession(session, input.userId)),
    );
  }

  async revokeSession(
    input: Readonly<{
      tenantId: string;
      userId: string;
      sessionId: string;
      approvalContext: ApprovalContext;
      effect?: IdentityEffectBinding;
    }>,
  ): Promise<IdentitySession> {
    await this.assertUser(input.tenantId, input.userId);
    const effect = requireEffect(input.effect ?? this.testOnlyEffect(input.sessionId), input.sessionId);
    await this.assertApproval(input.approvalContext, {
      operation: 'revoke_session',
      tenantId: input.tenantId,
      userId: input.userId,
      effect,
    });
    const store = this.options.store ?? this.options.openStore?.();
    const ownsStore = !this.options.store && Boolean(store);
    let dispatched = false;
    try {
      const binding = toProviderBinding(
        input,
        effect,
        'revoke_session',
        new Date((this.options.now ?? Date.now)()).toISOString(),
      );
      const existingState = store ? await readProviderEffectState(store, binding) : undefined;
      if (existingState !== 'uncertain' && existingState !== 'succeeded') {
        const sessions = await this.listSessions(input);
        const session = sessions.find(candidate => candidate.id === input.sessionId);
        if (!session || session.status !== 'active') throw new DomainError('VALIDATION_FAILED');
      }
      const claimed = store ? await claimProviderEffect(store, binding) : 'claimed';
      if (claimed === 'succeeded') return verifyRevoked(this, input, store, binding);
      if (claimed === 'uncertain') {
        const verified = await verifyRevoked(this, input, store, binding).catch(() => undefined);
        if (!verified) throw new DomainError('STORAGE_UNAVAILABLE', { retryable: true });
        if (store)
          await reconcileProviderEffect(store, {
            idempotencyKey: effect.idempotencyKey,
            fenceToken: input.approvalContext.fenceToken,
            succeeded: true,
            now: new Date().toISOString(),
          });
        return verified;
      }
      if (claimed === 'in_flight') throw new DomainError('STORAGE_UNAVAILABLE', { retryable: true });
      dispatched = true;
      const result = parseSession(
        await this.call(this.options.client.userManagement.revokeSession(input.sessionId)),
        input.userId,
      );
      if (result.id !== input.sessionId || result.status !== 'revoked') throw new DomainError('CONFLICT');
      const confirmed = await verifyRevoked(this, input, store, binding);
      if (store)
        await finishProviderEffect(store, {
          idempotencyKey: effect.idempotencyKey,
          fenceToken: input.approvalContext.fenceToken,
          status: 'succeeded',
          externalRef: `workos:${input.sessionId}`,
          now: new Date().toISOString(),
        });
      return confirmed;
    } catch (error) {
      // A transport rejection after dispatch is just as ambiguous as a local
      // timeout.  Preserve the uncertain ledger record and require a readback
      // on the next invocation instead of issuing a second revoke.
      if ((error instanceof ProviderTimeoutError || dispatched) && store) {
        await finishProviderEffect(store, {
          idempotencyKey: effect.idempotencyKey,
          fenceToken: input.approvalContext.fenceToken,
          status: 'uncertain',
          now: new Date().toISOString(),
        });
        throw new DomainError('STORAGE_UNAVAILABLE', { retryable: true });
      }
      throw error;
    } finally {
      if (ownsStore) store?.close();
    }
  }

  async restoreRole(
    input: Readonly<{
      tenantId: string;
      userId: string;
      membershipId: string;
      expectedCurrentRole: string;
      previousRole: string;
      approvalContext: ApprovalContext;
      effect?: IdentityEffectBinding;
    }>,
  ): Promise<IdentityMembership> {
    await this.assertUser(input.tenantId, input.userId);
    const effect = requireEffect(input.effect ?? this.testOnlyEffect(input.userId), input.userId);
    await this.assertApproval(input.approvalContext, {
      operation: 'restore_previous_role',
      tenantId: input.tenantId,
      userId: input.userId,
      effect,
    });
    if (
      !this.options.allowedRoleSlugs.has(input.expectedCurrentRole) ||
      !this.options.allowedRoleSlugs.has(input.previousRole)
    )
      throw new DomainError('VALIDATION_FAILED');
    const before = parseMembership(
      await this.call(this.options.client.organizations.getMembership(input.membershipId)),
      input.userId,
      this.options.organizationId,
    );
    const store = this.options.store ?? this.options.openStore?.();
    const ownsStore = !this.options.store && Boolean(store);
    let dispatched = false;
    try {
      const binding = toProviderBinding(
        input,
        effect,
        'restore_previous_role',
        new Date((this.options.now ?? Date.now)()).toISOString(),
      );
      const claimed = store ? await claimProviderEffect(store, binding) : 'claimed';
      if (claimed === 'succeeded') return verifyRole(this, input);
      if (claimed === 'uncertain') {
        const verified = await verifyRole(this, input).catch(() => undefined);
        if (!verified) throw new DomainError('STORAGE_UNAVAILABLE', { retryable: true });
        if (store)
          await reconcileProviderEffect(store, {
            idempotencyKey: effect.idempotencyKey,
            fenceToken: input.approvalContext.fenceToken,
            succeeded: true,
            now: new Date((this.options.now ?? Date.now)()).toISOString(),
          });
        return verified;
      }
      if (claimed === 'in_flight') throw new DomainError('STORAGE_UNAVAILABLE', { retryable: true });
      if (before.roleSlug !== input.expectedCurrentRole) throw new DomainError('CONFLICT');
      if (store)
        await armExpectedWorkosMembershipCallback(store, {
          effect: binding,
          membershipId: input.membershipId,
          expectedPreviousRole: input.expectedCurrentRole,
          expectedRole: input.previousRole,
        });
      dispatched = true;
      const after = parseMembership(
        await this.call(
          this.options.client.organizations.updateMembership(input.membershipId, { roleSlug: input.previousRole }),
        ),
        input.userId,
        this.options.organizationId,
      );
      if (after.id !== input.membershipId || after.roleSlug !== input.previousRole) throw new DomainError('CONFLICT');
      const verified = await verifyRole(this, input);
      if (store)
        await finishProviderEffect(store, {
          idempotencyKey: effect.idempotencyKey,
          fenceToken: input.approvalContext.fenceToken,
          status: 'succeeded',
          externalRef: `workos:${input.membershipId}`,
          now: new Date((this.options.now ?? Date.now)()).toISOString(),
        });
      return verified;
    } catch (error) {
      if ((error instanceof ProviderTimeoutError || dispatched) && store) {
        await finishProviderEffect(store, {
          idempotencyKey: effect.idempotencyKey,
          fenceToken: input.approvalContext.fenceToken,
          status: 'uncertain',
          now: new Date((this.options.now ?? Date.now)()).toISOString(),
        });
        throw new DomainError('STORAGE_UNAVAILABLE', { retryable: true });
      }
      throw error;
    } finally {
      if (ownsStore) store?.close();
    }
  }

  async verifyMembership(
    input: Readonly<{
      userId: string;
      membershipId: string;
      previousRole: string;
    }>,
  ): Promise<IdentityMembership> {
    const verified = parseMembership(
      await this.call(this.options.client.organizations.getMembership(input.membershipId)),
      input.userId,
      this.options.organizationId,
    );
    if (verified.roleSlug !== input.previousRole) throw new DomainError('CONFLICT');
    return verified;
  }

  private async assertUser(tenantId: string, userId: string): Promise<void> {
    if (
      tenantId !== this.options.organizationId ||
      (this.options.allowedUserIds.size > 0 && !this.options.allowedUserIds.has(userId))
    )
      throw new DomainError('VALIDATION_FAILED');
    // A global WorkOS user ID does not establish organization membership.
    // Recheck remotely even when an optional user allowlist is configured.
    const response = object(
      await this.call(
        this.options.client.userManagement.listOrganizationMemberships({
          userId,
          organizationId: this.options.organizationId,
          statuses: ['active'],
        }),
      ),
    );
    if (
      !Array.isArray(response.data) ||
      !response.data.some(value => {
        const membership = object(value);
        return (
          membership.userId === userId &&
          membership.organizationId === this.options.organizationId &&
          membership.status === 'active'
        );
      })
    )
      throw new DomainError('VALIDATION_FAILED');
  }

  private call<T>(operation: Promise<T>): Promise<T> {
    return withProviderTimeout(operation, this.options.timeoutMs ?? 1_500);
  }

  private async assertApproval(
    context: ApprovalContext,
    binding: Omit<Parameters<IdentityMutationAuthorizer>[0], 'approvalContext'>,
  ): Promise<void> {
    approvalContextSchema.parse(context);
    if (Date.parse(context.deadline) <= (this.options.now ?? Date.now)()) throw new DomainError('VALIDATION_FAILED');
    // The adapter has no authority to turn arbitrary strings into approval.
    // Its mutation capability is supplied by the gateway's durable claim.
    if (
      !this.options.authorizeMutation ||
      !(await this.options.authorizeMutation({
        ...binding,
        approvalContext: context,
      }))
    )
      throw new DomainError('VALIDATION_FAILED');
  }

  private testOnlyEffect(targetId: string): IdentityEffectBinding | undefined {
    // No-store constructors are hermetic fake adapters used by unit tests.
    // A staging factory always supplies an operational-store boundary and
    // therefore requires the target-bound durable claim from the gateway.
    if (this.options.store || this.options.openStore) return undefined;
    return {
      incidentId: 'test-incident',
      planId: 'test-plan',
      actionId: 'test-action',
      targetId,
      idempotencyKey: `test:${targetId}`,
    };
  }
}

function requireEffect(value: IdentityEffectBinding | undefined, targetId: string): IdentityEffectBinding {
  const effect = effectBindingSchema.parse(value);
  if (effect.targetId !== targetId) throw new DomainError('VALIDATION_FAILED');
  return effect;
}

function toProviderBinding(
  input: Readonly<{
    tenantId: string;
    userId: string;
    approvalContext: ApprovalContext;
  }>,
  effect: IdentityEffectBinding,
  operation: ProviderEffectBinding['operation'],
  now: string,
): ProviderEffectBinding {
  return {
    provider: 'workos',
    tenantId: input.tenantId,
    incidentId: effect.incidentId,
    approvalId: input.approvalContext.approvalId,
    subjectId: input.userId,
    planId: effect.planId,
    actionId: effect.actionId,
    targetId: effect.targetId,
    idempotencyKey: effect.idempotencyKey,
    fenceToken: input.approvalContext.fenceToken,
    operation,
    now,
  };
}

async function verifyRevoked(
  provider: WorkOsIdentityProvider,
  input: Readonly<{ tenantId: string; userId: string; sessionId: string }>,
  store?: OperationalStore,
  binding?: ProviderEffectBinding,
): Promise<IdentitySession> {
  if (store && binding && (await hasObservedWorkosSessionRevocation(store, binding)))
    return IdentitySessionSchema.parse({
      id: input.sessionId,
      userId: input.userId,
      status: 'revoked',
    });
  const verified = await provider.listSessions(input);
  const confirmed = verified.find(candidate => candidate.id === input.sessionId);
  if (!confirmed || confirmed.status !== 'revoked') throw new DomainError('CONFLICT');
  return confirmed;
}

async function verifyRole(
  provider: WorkOsIdentityProvider,
  input: Readonly<{
    tenantId: string;
    userId: string;
    membershipId: string;
    previousRole: string;
  }>,
): Promise<IdentityMembership> {
  return provider.verifyMembership(input);
}

class ProviderTimeoutError extends Error {}
async function withProviderTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new ProviderTimeoutError()), timeoutMs);
        timer.unref();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') throw new DomainError('VALIDATION_FAILED');
  return value as Record<string, unknown>;
}
function parseUser(value: unknown, tenantId: string, expectedId: string): IdentityUser {
  const row = object(value);
  const user = IdentityUserSchema.parse({
    id: row.id,
    tenantId,
    status: row.status === 'inactive' ? 'inactive' : row.status === 'active' ? 'active' : 'unknown',
    ...(typeof row.createdAt === 'string' ? { createdAt: row.createdAt } : {}),
  });
  if (user.id !== expectedId) throw new DomainError('CONFLICT');
  return user;
}
function parseSession(value: unknown, userId: string): IdentitySession {
  const row = object(value);
  const session = IdentitySessionSchema.parse({
    id: row.id,
    userId: row.userId ?? userId,
    status:
      row.status === 'active'
        ? 'active'
        : row.status === 'revoked'
          ? 'revoked'
          : row.status === 'expired' || row.status === 'ended'
            ? 'expired'
            : 'unknown',
    ...(typeof row.createdAt === 'string' ? { createdAt: row.createdAt } : {}),
    ...(typeof row.revokedAt === 'string' ? { revokedAt: row.revokedAt } : {}),
  });
  if (session.userId !== userId) throw new DomainError('CONFLICT');
  return session;
}
function parseMembership(value: unknown, userId: string, organizationId: string): IdentityMembership {
  const row = object(value);
  if (row.organizationId !== organizationId) throw new DomainError('CONFLICT');
  const membership = IdentityMembershipSchema.parse({
    id: row.id,
    userId: row.userId ?? userId,
    roleSlug: typeof row.roleSlug === 'string' ? row.roleSlug : object(row.role).slug,
    status: row.status,
    ...(typeof row.updatedAt === 'string' ? { updatedAt: row.updatedAt } : {}),
  });
  if (membership.status !== 'active') throw new DomainError('CONFLICT');
  if (membership.userId !== userId) throw new DomainError('CONFLICT');
  return membership;
}
