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
    value: z
      .string()
      .min(1)
      .max(4096)
      .regex(/^[\x20-\x7e]+$/),
    name: z.enum(['authorization', 'cookie', 'x-api-key', 'x-test-identity']).optional(),
  })
  .strict();
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
function requireBinding(expected: IdentityBinding, current: IdentityBinding) {
  if (
    Object.keys(current).some(key => expected[key as keyof IdentityBinding] !== current[key as keyof IdentityBinding])
  ) {
    throw new ControlPlaneError('REVISION_CONFLICT', 409);
  }
}
export type MutationScope = { owner: string; kind: RecordKind; id: string; revision: number };
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
  private authorizeProfile(target: Target, profile: Pick<Profile, 'kind'> & { identityEndpoint?: string }) {
    if (profile.kind === 'public') return;
    const endpoint = new URL(profile.identityEndpoint!);
    if (
      !target.approvedOrigins.includes(endpoint.origin) ||
      !target.permittedMethods.includes('GET') ||
      !pathAllowed(endpoint.pathname, target)
    ) {
      throw new ControlPlaneError('IDENTITY_SCOPE_DENIED', 403);
    }
  }
  async createTarget(owner: string, input: unknown) {
    const data = parse(targetSchema, input);
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
        (await this.store.get<Profile>('profile', otherId, owner, transaction)).role === data.role
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
  private async applyCheckIdentity(owner: string, targetId: string, id: string, input: unknown) {
    const binding = parse(bindingSchema, input);
    const { target, profile, policy } = await this.context(owner, targetId, id);
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
        (await this.store.get<Profile>('profile', otherId, target.owner, transaction)).role === data.role
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
            ? 'IDENTITY_MATCHED'
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
