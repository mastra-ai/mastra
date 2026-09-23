import { DomainError } from '../domain/errors.js';
import type {
  ApprovalContext,
  IdentityMembership,
  IdentityProvider,
  IdentitySession,
  IdentityUser,
} from './identity-provider.js';

/** Deterministic identity double; mutations still require a gateway-provided approval context. */
export class LocalIdentityProvider implements IdentityProvider {
  readonly calls: string[] = [];
  private readonly sessions = new Map<string, IdentitySession>();
  private readonly memberships = new Map<string, IdentityMembership>();
  constructor(
    private readonly data: Readonly<{
      users: readonly IdentityUser[];
      sessions: readonly IdentitySession[];
      memberships: readonly IdentityMembership[];
      fail?: boolean;
      failOperations?: ReadonlySet<'getUser' | 'listSessions' | 'revokeSession' | 'restoreRole'>;
      authorizeMutation?: () => boolean;
    }>,
  ) {
    for (const session of data.sessions) this.sessions.set(session.id, session);
    for (const membership of data.memberships) this.memberships.set(membership.id, membership);
  }
  async getUser(input: { tenantId: string; userId: string }): Promise<IdentityUser> {
    this.calls.push('getUser');
    const user = this.data.users.find(
      candidate => candidate.id === input.userId && candidate.tenantId === input.tenantId,
    );
    if (!user || this.data.fail || this.data.failOperations?.has('getUser'))
      throw new DomainError('STORAGE_UNAVAILABLE', { retryable: true });
    return user;
  }
  async listSessions(input: { tenantId: string; userId: string }): Promise<readonly IdentitySession[]> {
    await this.getUser(input);
    if (this.data.failOperations?.has('listSessions'))
      throw new DomainError('STORAGE_UNAVAILABLE', { retryable: true });
    this.calls.push('listSessions');
    return Object.freeze([...this.sessions.values()].filter(session => session.userId === input.userId));
  }
  async revokeSession(input: {
    tenantId: string;
    userId: string;
    sessionId: string;
    approvalContext: ApprovalContext;
  }): Promise<IdentitySession> {
    await this.getUser(input);
    this.assertApproval(input.approvalContext);
    if (!this.data.authorizeMutation?.()) throw new DomainError('VALIDATION_FAILED');
    if (this.data.failOperations?.has('revokeSession'))
      throw new DomainError('STORAGE_UNAVAILABLE', { retryable: true });
    this.calls.push('revokeSession');
    const session = [...this.sessions.values()].find(
      candidate => candidate.id === input.sessionId && candidate.userId === input.userId,
    );
    if (!session) throw new DomainError('VALIDATION_FAILED');
    if (session.status !== 'active') throw new DomainError('VALIDATION_FAILED');
    const revoked = { ...session, status: 'revoked' as const };
    this.sessions.set(revoked.id, revoked);
    return revoked;
  }
  async restoreRole(input: {
    tenantId: string;
    userId: string;
    membershipId: string;
    expectedCurrentRole: string;
    previousRole: string;
    approvalContext: ApprovalContext;
  }): Promise<IdentityMembership> {
    await this.getUser(input);
    this.assertApproval(input.approvalContext);
    if (!this.data.authorizeMutation?.()) throw new DomainError('VALIDATION_FAILED');
    if (this.data.failOperations?.has('restoreRole')) throw new DomainError('STORAGE_UNAVAILABLE', { retryable: true });
    this.calls.push('restoreRole');
    if (!['member', 'viewer'].includes(input.previousRole)) throw new DomainError('VALIDATION_FAILED');
    const membership = [...this.memberships.values()].find(
      candidate => candidate.id === input.membershipId && candidate.userId === input.userId,
    );
    if (!membership || membership.roleSlug !== input.expectedCurrentRole) throw new DomainError('CONFLICT');
    const restored = { ...membership, roleSlug: input.previousRole };
    this.memberships.set(restored.id, restored);
    return restored;
  }
  /**
   * Read-only inspection used by the hermetic provider-contract harness.  It
   * deliberately mirrors the WorkOS adapter's post-mutation membership
   * readback without widening the IdentityProvider production interface.
   */
  async verifyMembership(input: {
    userId: string;
    membershipId: string;
    previousRole: string;
  }): Promise<IdentityMembership> {
    this.calls.push('getMembership');
    const membership = this.memberships.get(input.membershipId);
    if (!membership || membership.userId !== input.userId || membership.roleSlug !== input.previousRole)
      throw new DomainError('CONFLICT');
    return membership;
  }
  private assertApproval(context: ApprovalContext) {
    if (!context.approvalId || !context.fenceToken || Date.parse(context.deadline) <= Date.now())
      throw new DomainError('VALIDATION_FAILED');
  }
}
