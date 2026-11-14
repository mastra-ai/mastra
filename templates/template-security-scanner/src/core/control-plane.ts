import { randomUUID } from 'node:crypto';
import type { Transaction } from '@libsql/client';
import { z } from 'zod';
import {
  bindingSchema,
  ControlPlaneError,
  parse,
  pathAllowed,
  policySchema,
  profileSchema,
  targetSchema,
  type IdentityBinding,
  type IdentityResult,
  type Policy,
  type Profile,
  type Target,
} from './contracts.js';
import { CredentialVault } from './credentials.js';
import { DisabledIdentityTransport, type IdentityTransport } from './identity.js';
import { DomainStore, type RecordKind } from './store.js';

const credentialSchema = z
  .object({
    /** Validated result or private credential value, according to the enclosing contract. */
    value: z
      .string()
      .min(1)
      .max(4096)
      .regex(/^[\x20-\x7e]+$/),
    /** Human-readable label shown in the console. */
    name: z.enum(['authorization', 'cookie', 'x-api-key', 'x-test-identity']).optional(),
  })
  .strict();
/** Reject a mutation whose expected revision differs from the persisted record. */
function requireRevision(actual: number, expected: number) {
  if (actual !== expected) throw new ControlPlaneError('REVISION_CONFLICT', 409);
}
const credentialBinding = (profile: Profile) => ({
  targetId: profile.targetId,
  profileId: profile.id,
  role: profile.role,
  credentialRevision: profile.credentialRevision,
});
function currentBinding(target: Target, profile: Profile): IdentityBinding {
  return {
    targetRevision: target.revision,
    policyRevision: target.policyRevision,
    profileId: profile.id,
    profileRevision: profile.revision,
    credentialRevision: profile.credentialRevision,
  };
}
/** Reject an identity result whose recorded revision binding has changed. */
function requireBinding(expected: IdentityBinding, current: IdentityBinding) {
  if (
    Object.keys(current).some(key => expected[key as keyof IdentityBinding] !== current[key as keyof IdentityBinding])
  ) {
    throw new ControlPlaneError('REVISION_CONFLICT', 409);
  }
}
/** Reject application-specific settings on the legacy execution path. */
function requireLegacyExecution(target: Target) {
  if (
    target.application !== undefined ||
    target.authenticationDrivers !== undefined ||
    target.routeAccessRules !== undefined
  )
    throw new ControlPlaneError('APPLICATION_DRIVER_UNSUPPORTED', 403);
}
/** Resolve and validate the API-key driver bound to the selected target and profile. */
function apiKeyDriver(target: Target, profile: Profile) {
  const driver = target.authenticationDrivers?.find(item => item.profileId === profile.id);
  if (profile.kind !== 'api_key_header' || driver?.kind !== 'api_key_header')
    throw new ControlPlaneError('AUTHENTICATION_DRIVER_UNSUPPORTED', 403);
  if (
    driver.secretRef !== profile.credentialRef ||
    driver.credentialOrigins.length !== 1 ||
    driver.credentialOrigins[0] !== new URL(target.entryUrl).origin
  )
    throw new ControlPlaneError('AUTHENTICATION_SCOPE_DENIED', 403);
  if (driver.expiresAt && Date.parse(driver.expiresAt) <= Date.now()) throw new ControlPlaneError('AUTH_REQUIRED', 403);
  if (
    !target.routeAccessRules?.some(
      rule =>
        rule.source === 'operator' &&
        rule.method === 'GET' &&
        rule.pathTemplate === driver.accessCheckPath &&
        rule.audience === 'user' &&
        rule.objectPolicy === 'owner',
    )
  )
    throw new ControlPlaneError('ACCESS_CHECK_RULE_REQUIRED', 403);
  return driver;
}
/** Reject unsupported application and authentication combinations before execution. */
function requireExecutableApplication(target: Target) {
  if (!target.application) return requireLegacyExecution(target);
  if (
    target.application.kind !== 'rest_api' ||
    !target.permittedMethods.every(method => ['GET', 'HEAD'].includes(method))
  )
    throw new ControlPlaneError('APPLICATION_DRIVER_UNSUPPORTED', 403);
  if (
    target.application.openApiUrl &&
    new URL(target.application.openApiUrl).origin !== new URL(target.entryUrl).origin
  )
    throw new ControlPlaneError('OPENAPI_ORIGIN_UNSUPPORTED', 403);
  if (!target.routeAccessRules?.some(rule => rule.source === 'operator' && rule.method === 'GET'))
    throw new ControlPlaneError('ROUTE_RULES_REQUIRED', 403);
  requireRouteRuleRevision(target, target.revision);
}
/** Require every operator route rule to match the target revision being executed. */
function requireRouteRuleRevision(target: Pick<Target, 'routeAccessRules'>, revision: number) {
  if (target.routeAccessRules?.some(rule => rule.source === 'operator' && rule.operatorRevision !== revision))
    throw new ControlPlaneError('INVALID_INPUT', 400);
}
/** Operator-owned record whose mutation must quiesce affected work. */
export type MutationScope = {
  /** Operator that owns this record; derived from the authenticated session. */
  owner: string;
  /** Discriminator selecting the supported record or credential shape. */
  kind: RecordKind;
  /** Stable identifier of this record. */
  id: string;
  /** Current optimistic-concurrency revision; stale writes are rejected. */
  revision: number;
};
/** Serialize validation and mutation with affected worker cancellation. */
export type MutationCoordinator = <T>(
  scope: MutationScope,
  validate: () => Promise<void>,
  commit: () => Promise<T>,
) => Promise<T>;
export class ControlPlane {
  constructor(
    public readonly store: DomainStore,
    private readonly vault: CredentialVault,
    private readonly identityTransport: IdentityTransport = new DisabledIdentityTransport(),
    private readonly coordinate: MutationCoordinator = async (_scope, validate, commit) => {
      await validate();
      return commit();
    },
  ) {}

  async createPolicy(owner: string, input: unknown) {
    const data = parse(policySchema, input);
    const policy: Policy = { ...data, id: randomUUID(), owner, revision: 1 };
    await this.store.write(transaction => this.store.insert('policy', policy, transaction));
    return policy;
  }
  private async applyUpdatePolicy(owner: string, id: string, revision: number, input: unknown) {
    const data = parse(policySchema, input);
    return this.store.write(async transaction => {
      const previous = await this.store.get<Policy>('policy', id, owner, transaction);
      requireRevision(previous.revision, revision);
      const policy: Policy = { ...data, id, owner, revision: revision + 1 };
      await this.store.replace('policy', policy, revision, transaction);
      return policy;
    });
  }
  /** Load the target and policy owned by the requesting operator or reject access. */
  private async authorizeTarget(target: Target, transaction: Transaction) {
    const policy = await this.store.get<Policy>('policy', target.policyId, target.owner, transaction);
    requireRevision(policy.revision, target.policyRevision);
    if (
      target.permittedMethods.some(method => !policy.permittedMethods.includes(method)) ||
      Object.entries(target.scanLimits).some(
        ([key, value]) => value > policy.scanLimits[key as keyof typeof policy.scanLimits],
      )
    ) {
      throw new ControlPlaneError('POLICY_SCOPE_DENIED', 403);
    }
    for (const profileId of target.authProfileIds) {
      const profile = await this.store.get<Profile>('profile', profileId, target.owner, transaction);
      if (profile.targetId !== target.id) throw new ControlPlaneError('PROFILE_SCOPE_DENIED', 403);
      this.authorizeProfile(target, profile);
    }
    return policy;
  }
  /** Load an operator-owned profile and reject a mismatched target binding. */
  private authorizeProfile(target: Target, profile: Pick<Profile, 'kind'> & { identityEndpoint?: string }) {
    if (profile.kind === 'public') return;
    if (profile.kind === 'api_key_header') {
      if (target.application?.kind !== 'rest_api' || !target.permittedMethods.includes('GET'))
        throw new ControlPlaneError('AUTHENTICATION_SCOPE_DENIED', 403);
      return;
    }
    const endpoint = new URL(profile.identityEndpoint!);
    if (
      !target.approvedOrigins.includes(endpoint.origin) ||
      !target.permittedMethods.includes('GET') ||
      !pathAllowed(endpoint.pathname, target)
    ) {
      throw new ControlPlaneError('IDENTITY_SCOPE_DENIED', 403);
    }
  }
  /** Validate target scope and policy binding before persisting its initial revision. */
  async createTarget(owner: string, input: unknown) {
    const data = parse(targetSchema, input);
    requireRouteRuleRevision(data, 1);
    if (data.authProfileIds.length) throw new ControlPlaneError('PROFILE_SCOPE_DENIED', 403);
    const target: Target = { ...data, id: randomUUID(), owner, revision: 1 };
    await this.store.write(async transaction => {
      await this.authorizeTarget(target, transaction);
      await this.store.insert('target', target, transaction);
    });
    return target;
  }
  private async applyUpdateTarget(owner: string, id: string, revision: number, input: unknown) {
    const data = parse(targetSchema, input);
    return this.store.write(async transaction => {
      const previous = await this.store.get<Target>('target', id, owner, transaction);
      requireRevision(previous.revision, revision);
      if (JSON.stringify([...previous.authProfileIds].sort()) !== JSON.stringify([...data.authProfileIds].sort())) {
        throw new ControlPlaneError('PROFILE_SCOPE_DENIED', 403);
      }
      const target: Target = { ...data, id, owner, revision: revision + 1 };
      await this.authorizeTarget(target, transaction);
      await this.store.replace('target', target, revision, transaction);
      return target;
    });
  }
  private async applyCreateProfile(owner: string, targetId: string, targetRevision: number, input: unknown) {
    const data = parse(profileSchema, input);
    const result = await this.store.write(async transaction => {
      const target = await this.store.get<Target>('target', targetId, owner, transaction);
      requireRevision(target.revision, targetRevision);
      await this.authorizeTarget(target, transaction);
      if (target.authProfileIds.length >= 32) throw new ControlPlaneError('PROFILE_LIMIT_REACHED', 409);
      const id = randomUUID();
      const profile = await this.persistProfile(owner, target, id, 1, 1, data, transaction);
      target.authProfileIds.push(id);
      target.revision++;
      await this.store.replace('target', target, targetRevision, transaction);
      return profile;
    });
    return this.profile(owner, targetId, result.id);
  }
  /** Seal profile credentials and atomically update the target's profile binding. */
  private async persistProfile(
    owner: string,
    target: Target,
    id: string,
    revision: number,
    credentialRevision: number,
    data: z.infer<typeof profileSchema>,
    transaction: Transaction,
    previous?: Profile,
  ) {
    this.authorizeProfile(target, data);
    for (const otherId of target.authProfileIds) {
      if (
        otherId !== id &&
        (await this.store.get<Profile>('profile', otherId, owner, transaction)).role === data.role &&
        data.kind !== 'api_key_header'
      ) {
        throw new ControlPlaneError('ROLE_CONFLICT', 409);
      }
    }
    const { credential, ...metadata } = { credential: undefined, ...data };
    const profile: Profile = { ...metadata, id, owner, targetId: target.id, revision, credentialRevision };
    if (data.kind !== 'public') {
      profile.credentialRef = id;
      const envelope = this.vault.seal(credential, credentialBinding(profile));
      if (previous) await this.store.replace('profile', profile, previous.revision, transaction);
      else await this.store.insert('profile', profile, transaction);
      await this.store.setEnvelope(id, envelope, transaction);
    } else {
      if (previous) {
        await this.store.replace('profile', profile, previous.revision, transaction);
        await this.store.deleteEnvelope(id, transaction);
      } else await this.store.insert('profile', profile, transaction);
    }
    return profile;
  }
  private async applyUpdateProfile(owner: string, targetId: string, id: string, revision: number, input: unknown) {
    const data = parse(profileSchema, input);
    await this.store.write(async transaction => {
      const { target, profile } = await this.context(owner, targetId, id, transaction);
      requireRevision(profile.revision, revision);
      await this.authorizeTarget(target, transaction);
      await this.persistProfile(
        owner,
        target,
        id,
        revision + 1,
        profile.credentialRevision + 1,
        data,
        transaction,
        profile,
      );
    });
    return this.profile(owner, targetId, id);
  }
  /** Build current execution context from the authorized target, policy and requested profiles. */
  private async context(owner: string, targetId: string, profileId: string, transaction?: Transaction) {
    const target = await this.store.get<Target>('target', targetId, owner, transaction);
    const profile = await this.store.get<Profile>('profile', profileId, owner, transaction);
    if (profile.targetId !== targetId || !target.authProfileIds.includes(profileId))
      throw new ControlPlaneError('PROFILE_SCOPE_DENIED', 403);
    const policy = await this.store.get<Policy>('policy', target.policyId, owner, transaction);
    return { target, profile, policy };
  }
  private async credentials(profile: Profile, transaction?: Transaction) {
    return parse(
      credentialSchema,
      this.vault.open(await this.store.envelope(profile.id, transaction), credentialBinding(profile)),
    );
  }
  async profile(owner: string, targetId: string, id: string) {
    return this.store.write(async transaction => {
      const { target, profile, policy } = await this.context(owner, targetId, id, transaction);
      const binding = currentBinding(target, profile);
      let status = profile.identityResult?.status ?? 'CHECK_REQUIRED';
      let reason = profile.identityResult?.reason ?? 'IDENTITY_CHECK_REQUIRED';
      if (profile.kind === 'public') {
        status = 'READY';
        reason = 'PUBLIC_IDENTITY';
      } else {
        try {
          await this.credentials(profile, transaction);
        } catch {
          status = 'CREDENTIAL_UNAVAILABLE';
          reason = 'CREDENTIAL_REREGISTRATION_REQUIRED';
        }
      }
      if (status !== 'CREDENTIAL_UNAVAILABLE') {
        if (profile.expiresAt && Date.parse(profile.expiresAt) <= Date.now()) {
          status = 'AUTH_REQUIRED';
          reason = 'SESSION_EXPIRED';
        } else if (
          policy.revision !== target.policyRevision ||
          (profile.identityResult &&
            Object.keys(binding).some(
              key => binding[key as keyof IdentityBinding] !== profile.identityResult![key as keyof IdentityBinding],
            ))
        ) {
          status = 'CHECK_REQUIRED';
          reason = 'BINDING_STALE';
        }
      }
      const { identityResult, ...metadata } = profile;
      return {
        ...metadata,
        identity: { ...binding, status, reason, checkedAt: profile.identityResult?.checkedAt ?? null },
      };
    });
  }
  async listProfiles(owner: string, targetId: string, limit: number, offset: number) {
    const target = await this.store.get<Target>('target', targetId, owner);
    return Promise.all(
      target.authProfileIds.slice(offset, offset + limit).map(id => this.profile(owner, targetId, id)),
    );
  }
  /** Apply an identity result only while its target, policy and profile revision binding remains current. */
  private async applyCheckIdentity(owner: string, targetId: string, id: string, input: unknown) {
    const binding = parse(bindingSchema, input);
    const { target, profile, policy } = await this.context(owner, targetId, id);
    requireLegacyExecution(target);
    requireBinding(binding, currentBinding(target, profile));
    requireRevision(policy.revision, target.policyRevision);
    this.authorizeProfile(target, profile);
    let observation: Pick<IdentityResult, 'status' | 'reason'>;
    if (profile.expiresAt && Date.parse(profile.expiresAt) <= Date.now())
      observation = { status: 'AUTH_REQUIRED', reason: 'SESSION_EXPIRED' };
    else if (profile.kind === 'public') observation = { status: 'READY', reason: 'PUBLIC_IDENTITY' };
    else {
      try {
        const credential = await this.credentials(profile);
        if (!this.identityTransport.supports(target, profile))
          observation = { status: 'UNAVAILABLE', reason: 'REMOTE_IDENTITY_DISABLED' };
        else {
          const headers =
            profile.kind === 'bearer'
              ? { authorization: `Bearer ${credential.value}` }
              : { [credential.name!]: credential.value };
          observation = await this.identityTransport.check(profile, headers);
        }
      } catch (error) {
        if (!(error instanceof ControlPlaneError)) throw error;
        observation = { status: 'CREDENTIAL_UNAVAILABLE', reason: 'CREDENTIAL_REREGISTRATION_REQUIRED' };
      }
    }
    // A socket check must not hold the mutation queue. Credential replacement
    // may proceed while it is in flight; its late result must then fail CAS.
    await this.coordinate(
      { owner, kind: 'profile', id, revision: binding.profileRevision },
      () =>
        this.store.write(async transaction => {
          const current = await this.context(owner, targetId, id, transaction);
          requireBinding(binding, currentBinding(current.target, current.profile));
          requireRevision(current.policy.revision, current.target.policyRevision);
        }),
      () =>
        this.store.write(async transaction => {
          const current = await this.context(owner, targetId, id, transaction);
          requireBinding(binding, currentBinding(current.target, current.profile));
          requireRevision(current.policy.revision, current.target.policyRevision);
          const updated: Profile = { ...current.profile, revision: current.profile.revision + 1 };
          updated.identityResult = {
            ...currentBinding(current.target, updated),
            ...observation,
            checkedAt: new Date().toISOString(),
          };
          await this.store.replace('profile', updated, profile.revision, transaction);
        }),
    );
    return this.profile(owner, targetId, id);
  }
  /** Validate execution context and atomically persist scan admission with its durable job state. */
  async admitScan(owner: string, targetId: string, input: unknown): Promise<never> {
    const binding = parse(bindingSchema, input);
    const { target, profile, policy } = await this.context(owner, targetId, binding.profileId);
    requireBinding(binding, currentBinding(target, profile));
    requireRevision(policy.revision, target.policyRevision);
    if (target.environment !== 'lab' && !policy.retention) throw new ControlPlaneError('RETENTION_REQUIRED', 403);
    const metadata = await this.profile(owner, targetId, profile.id);
    if (metadata.identity.status !== 'READY')
      throw new ControlPlaneError(metadata.identity.status, metadata.identity.status === 'AUTH_REQUIRED' ? 403 : 503);
    throw new ControlPlaneError('EXECUTION_DISABLED', 503);
  }
  private async applyRemove(owner: string, kind: RecordKind, id: string, revision: number, targetId?: string) {
    await this.store.write(async transaction => {
      const record = await this.store.get<Policy | Target | Profile>(kind, id, owner, transaction);
      requireRevision(record.revision, revision);
      if (kind === 'policy' && (await this.store.dependentTargets(id, owner, transaction)))
        throw new ControlPlaneError('POLICY_IN_USE', 409);
      if (kind === 'target') {
        for (const profileId of (record as Target).authProfileIds) {
          const profile = await this.store.get<Profile>('profile', profileId, owner, transaction);
          await this.store.remove('profile', profile.id, owner, profile.revision, transaction);
        }
      }
      if (kind === 'profile') {
        const context = await this.context(owner, targetId!, id, transaction);
        const target = {
          ...context.target,
          authProfileIds: context.target.authProfileIds.filter(profileId => profileId !== id),
          revision: context.target.revision + 1,
        };
        await this.store.replace('target', target, context.target.revision, transaction);
      }
      await this.store.remove(kind, id, owner, revision, transaction);
    });
  }
  /** Rebuild authorized scan context and reject stale revisions or identity bindings. */
  async scanContext(
    owner: string,
    targetId: string,
    request: {
      targetRevision: number;
      policyRevision: number;
      profiles: IdentityBinding[];
      operation?: 'discovery' | 'identity';
    },
    transaction: Transaction,
  ) {
    const target = await this.store.get<Target>('target', targetId, owner, transaction);
    requireRevision(target.revision, request.targetRevision);
    requireExecutableApplication(target);
    const policy = await this.authorizeTarget(target, transaction);
    requireRevision(policy.revision, request.policyRevision);
    if (target.environment !== 'lab' && !policy.retention) throw new ControlPlaneError('RETENTION_REQUIRED', 403);
    const profiles: Profile[] = [],
      headers: Record<string, string>[] = [];
    for (const binding of request.profiles) {
      const current = await this.context(owner, targetId, binding.profileId, transaction);
      requireBinding(binding, currentBinding(target, current.profile));
      if (current.profile.expiresAt && Date.parse(current.profile.expiresAt) <= Date.now())
        throw new ControlPlaneError('AUTH_REQUIRED', 403);
      const profile = current.profile;
      if (target.application?.kind === 'rest_api' && profile.kind !== 'public' && profile.kind !== 'api_key_header')
        throw new ControlPlaneError('AUTHENTICATION_DRIVER_UNSUPPORTED', 403);
      if (
        profile.kind !== 'public' &&
        profile.identityResult?.status === 'AUTH_REQUIRED' &&
        profile.identityResult.credentialRevision === profile.credentialRevision &&
        request.operation !== 'identity'
      )
        throw new ControlPlaneError('AUTH_REQUIRED', 403);
      profiles.push(profile);
      if (profile.kind === 'public') headers.push({});
      else {
        const credential = await this.credentials(profile, transaction);
        headers.push(
          profile.kind === 'bearer'
            ? { authorization: `Bearer ${credential.value}` }
            : profile.kind === 'api_key_header'
              ? { [apiKeyDriver(target, profile).headerName.toLowerCase()]: credential.value }
              : { [credential.name!]: credential.value },
        );
      }
    }
    const guardHeaders: Array<{ profileId: string; headers: Record<string, string> }> = [];
    for (const id of target.authProfileIds) {
      const profile = await this.store.get<Profile>('profile', id, owner, transaction);
      if (profile.kind === 'public') continue;
      const credential = await this.credentials(profile, transaction);
      guardHeaders.push({
        profileId: id,
        headers:
          profile.kind === 'bearer'
            ? { authorization: `Bearer ${credential.value}` }
            : profile.kind === 'api_key_header'
              ? { [apiKeyDriver(target, profile).headerName.toLowerCase()]: credential.value }
              : { [credential.name!]: credential.value },
      });
    }
    return { target, policy, profiles, headers, guardHeaders };
  }
  private async validateMutation(scope: MutationScope, input?: unknown, targetId?: string) {
    await this.store.write(async transaction => {
      const record = await this.store.get<Policy | Target | Profile>(scope.kind, scope.id, scope.owner, transaction);
      requireRevision(record.revision, scope.revision);
      if (scope.kind === 'policy' && !input && (await this.store.dependentTargets(scope.id, scope.owner, transaction)))
        throw new ControlPlaneError('POLICY_IN_USE', 409);
      if (scope.kind === 'profile') {
        if (!targetId) throw new ControlPlaneError('PROFILE_SCOPE_DENIED', 403);
        const context = await this.context(scope.owner, targetId, scope.id, transaction);
        if (input) {
          await this.authorizeTarget(context.target, transaction);
          await this.validateProfileData(context.target, parse(profileSchema, input), scope.id, transaction);
        }
      }
      if (scope.kind === 'target' && input) {
        const data = parse(targetSchema, input),
          previous = record as Target;
        if (JSON.stringify([...previous.authProfileIds].sort()) !== JSON.stringify([...data.authProfileIds].sort()))
          throw new ControlPlaneError('PROFILE_SCOPE_DENIED', 403);
        await this.authorizeTarget(
          { ...data, id: scope.id, owner: scope.owner, revision: scope.revision + 1 },
          transaction,
        );
      }
    });
  }
  /** Validate profile-specific credentials and identity configuration against the target boundary. */
  private async validateProfileData(
    target: Target,
    data: z.infer<typeof profileSchema>,
    id: string,
    transaction: Transaction,
  ) {
    this.authorizeProfile(target, data);
    for (const otherId of target.authProfileIds)
      if (
        otherId !== id &&
        (await this.store.get<Profile>('profile', otherId, target.owner, transaction)).role === data.role &&
        data.kind !== 'api_key_header'
      )
        throw new ControlPlaneError('ROLE_CONFLICT', 409);
    if (data.kind !== 'public')
      this.vault.seal(data.credential, { targetId: target.id, profileId: id, role: data.role, credentialRevision: 1 });
  }
  async updatePolicy(owner: string, id: string, revision: number, input: unknown) {
    const data = parse(policySchema, input);
    const scope = { owner, kind: 'policy' as const, id, revision };
    return this.coordinate(
      scope,
      () => this.validateMutation(scope, data),
      () => this.applyUpdatePolicy(owner, id, revision, data),
    );
  }
  async updateTarget(owner: string, id: string, revision: number, input: unknown) {
    const data = parse(targetSchema, input);
    requireRouteRuleRevision(data, revision + 1);
    const scope = { owner, kind: 'target' as const, id, revision };
    return this.coordinate(
      scope,
      () => this.validateMutation(scope, data),
      () => this.applyUpdateTarget(owner, id, revision, data),
    );
  }
  async updateProfile(owner: string, targetId: string, id: string, revision: number, input: unknown) {
    const data = parse(profileSchema, input);
    const scope = { owner, kind: 'profile' as const, id, revision };
    return this.coordinate(
      scope,
      () => this.validateMutation(scope, data, targetId),
      () => this.applyUpdateProfile(owner, targetId, id, revision, data),
    );
  }
  async createProfile(owner: string, targetId: string, targetRevision: number, input: unknown) {
    const data = parse(profileSchema, input),
      scope = { owner, kind: 'target' as const, id: targetId, revision: targetRevision };
    return this.coordinate(
      scope,
      () =>
        this.store.write(async transaction => {
          const target = await this.store.get<Target>('target', targetId, owner, transaction);
          requireRevision(target.revision, targetRevision);
          await this.authorizeTarget(target, transaction);
          if (target.authProfileIds.length >= 32) throw new ControlPlaneError('PROFILE_LIMIT_REACHED', 409);
          await this.validateProfileData(target, data, randomUUID(), transaction);
        }),
      () => this.applyCreateProfile(owner, targetId, targetRevision, data),
    );
  }
  async remove(owner: string, kind: RecordKind, id: string, revision: number, targetId?: string) {
    const scope = { owner, kind, id, revision };
    return this.coordinate(
      scope,
      () => this.validateMutation(scope, undefined, targetId),
      () => this.applyRemove(owner, kind, id, revision, targetId),
    );
  }
  async checkIdentity(owner: string, targetId: string, id: string, input: unknown) {
    return this.applyCheckIdentity(owner, targetId, id, input);
  }
  async recordDiscoveryIdentity(
    owner: string,
    targetId: string,
    binding: IdentityBinding,
    status: 'READY' | 'AUTH_REQUIRED' | 'UNAVAILABLE',
  ) {
    await this.store.write(async transaction => {
      const current = await this.context(owner, targetId, binding.profileId, transaction);
      requireBinding(binding, currentBinding(current.target, current.profile));
      if (current.profile.kind === 'public') return;
      const updated: Profile = { ...current.profile, revision: current.profile.revision + 1 };
      updated.identityResult = {
        ...currentBinding(current.target, updated),
        status,
        reason:
          status === 'READY'
            ? current.profile.kind === 'api_key_header'
              ? 'ACCESS_CHECK_SUCCEEDED'
              : 'IDENTITY_MATCHED'
            : status === 'AUTH_REQUIRED'
              ? 'SESSION_REJECTED'
              : 'IDENTITY_TRANSPORT_FAILED',
        checkedAt: new Date().toISOString(),
      };
      await this.store.replace('profile', updated, current.profile.revision, transaction);
    });
  }
}
export type ScanContext = Awaited<ReturnType<ControlPlane['scanContext']>>;
