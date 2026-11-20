import { createHash } from 'node:crypto';

import { EvidenceProviderResultSchema, type EvidenceFact, type EvidenceProviderInput } from '../evidence/contracts.js';
import { DomainError } from '../domain/errors.js';
import type { IdentityEvidenceProvider, SafeProviderCall } from './evidence-provider.js';
import { executeLocalInspection, type LocalProviderOptions } from './local-evidence.js';
import type { IdentityProvider } from './identity-provider.js';

export class LocalIdentityEvidenceProvider implements IdentityEvidenceProvider {
  readonly source = 'identity' as const;
  readonly providerId = 'local-identity';
  readonly calls: SafeProviderCall[] = [];
  constructor(private readonly options: LocalProviderOptions = {}) {}

  async inspect(
    input: Parameters<IdentityEvidenceProvider['inspect']>[0],
    options: Parameters<IdentityEvidenceProvider['inspect']>[1],
  ) {
    return executeLocalInspection({
      provider: this.providerId,
      providerRef: 'identity',
      request: input,
      signal: options.signal,
      attempt: options.attempt,
      behavior: this.options.behavior ?? 'success',
      ...(this.options.release ? { release: this.options.release } : {}),
      ...(this.options.onStart ? { onStart: this.options.onStart } : {}),
      callLog: this.calls,
      facts: async request => identityFacts(request),
    });
  }
}

/** Read-only projection of the integration WorkOS domain boundary for investigation. */
export class WorkOsIdentityEvidenceProvider implements IdentityEvidenceProvider {
  readonly source = 'identity' as const;
  readonly providerId = 'workos-identity';
  constructor(private readonly identity: IdentityProvider) {}

  async inspect(
    input: EvidenceProviderInput,
    options: Readonly<{ signal: AbortSignal; attempt: 1 | 2 }>,
  ): Promise<unknown> {
    if (options.signal.aborted) return failure(this.providerId, 'aborted', 'ABORTED', false, options.attempt);
    try {
      const [user, sessions] = await Promise.all([
        this.identity.getUser({
          tenantId: input.tenantId,
          userId: input.subjectId,
        }),
        this.identity.listSessions({
          tenantId: input.tenantId,
          userId: input.subjectId,
        }),
      ]);
      if (options.signal.aborted) return failure(this.providerId, 'aborted', 'ABORTED', false, options.attempt);
      const facts: EvidenceFact[] = [
        identityFact(input.occurredAt, 'identity.user.status', 'user.status', user.status),
      ];
      if (input.sessionId) {
        const session = sessions.find(candidate => candidate.id === input.sessionId);
        if (!session) return failure(this.providerId, 'not_found', 'NOT_FOUND', false, options.attempt);
        facts.push(
          identityFact(input.occurredAt, 'identity.session.status', 'session.status', session.status),
          identityFact(input.occurredAt, 'identity.session.subject', 'session.subject', input.subjectId),
        );
      }
      facts.push(...contextPrivilegeFacts(input));
      return EvidenceProviderResultSchema.parse({
        status: 'success',
        provider: this.providerId,
        facts,
      });
    } catch (error) {
      if (options.signal.aborted) return failure(this.providerId, 'aborted', 'ABORTED', false, options.attempt);
      if (error instanceof DomainError && error.code === 'NOT_FOUND')
        return failure(this.providerId, 'not_found', 'NOT_FOUND', false, options.attempt);
      if (error instanceof DomainError && error.code === 'VALIDATION_FAILED')
        return failure(this.providerId, 'invalid_response', 'INVALID_RESPONSE', false, options.attempt);
      return failure(this.providerId, 'unavailable', 'UNAVAILABLE', true, options.attempt);
    }
  }
}

/** Remote runtimes never replace a disabled WorkOS boundary with local data. */
export class DisabledIdentityEvidenceProvider implements IdentityEvidenceProvider {
  readonly source = 'identity' as const;
  readonly providerId = 'disabled-identity';
  async inspect(_input: EvidenceProviderInput, options: Readonly<{ signal: AbortSignal; attempt: 1 | 2 }>) {
    return failure(
      this.providerId,
      options.signal.aborted ? 'aborted' : 'operational_error',
      options.signal.aborted ? 'ABORTED' : 'UNAVAILABLE',
      false,
      options.attempt,
    );
  }
}

function identityFact(observedAt: string, semanticKey: string, factType: string, value: string): EvidenceFact {
  return {
    semanticKey,
    observedAt,
    factType,
    value,
    confidence: 1,
    confidenceProvenance: 'provider',
    rawPayloadRef: `sha256:${createHash('sha256').update(`${semanticKey}\0${value}`).digest('hex')}`,
    sensitivity: 'confidential',
    incomplete: false,
  };
}

function contextPrivilegeFacts(input: EvidenceProviderInput): EvidenceFact[] {
  if (input.incidentKind !== 'unauthorized_privilege_change' || !input.actorId || !input.roleChange) return [];
  const facts: EvidenceFact[] = [
    identityFact(input.occurredAt, 'identity.role.previous', 'role.previous', input.roleChange.previousRole),
    identityFact(input.occurredAt, 'identity.role.current', 'role.current', input.roleChange.currentRole),
    identityFact(input.occurredAt, 'identity.actor', 'actor.id', input.actorId),
  ];
  if (input.changeApproved !== undefined) {
    facts.push({
      ...booleanFact(input.occurredAt, 'identity.change.approved', 'change.approved', input.changeApproved),
      confidenceProvenance: 'rule-v1',
      rawPayloadRef: 'protected:local-role-change-authorization',
    });
  }
  return facts;
}

function failure(
  provider: string,
  status: 'not_found' | 'aborted' | 'unavailable' | 'operational_error' | 'invalid_response',
  code: 'NOT_FOUND' | 'ABORTED' | 'UNAVAILABLE' | 'INVALID_RESPONSE',
  retryable: boolean,
  attempt: 1 | 2,
) {
  return EvidenceProviderResultSchema.parse({
    status,
    provider,
    error: {
      code,
      retryable,
      safeRef: `provider:${provider}:attempt-${attempt}`,
      attempt,
    },
  });
}

function identityFacts(input: Parameters<IdentityEvidenceProvider['inspect']>[0]): readonly EvidenceFact[] {
  if (input.incidentKind === 'unauthorized_privilege_change') {
    const roleChange = input.roleChange ?? {
      previousRole: 'member',
      currentRole: 'admin',
    };
    return [
      fact(input.occurredAt, 'previous-role', 'role.previous', roleChange.previousRole),
      fact(input.occurredAt, 'current-role', 'role.current', roleChange.currentRole),
      fact(input.occurredAt, 'actor', 'actor.id', input.actorId ?? input.subjectId),
      booleanFact(input.occurredAt, 'approved-change', 'change.approved', input.changeApproved ?? false),
      ...(input.sessionId
        ? [
            fact(input.occurredAt, 'session-subject', 'session.subject', input.subjectId),
            booleanFact(input.occurredAt, 'session-active', 'session.active', true),
          ]
        : []),
    ];
  }
  return [fact(input.occurredAt, 'session-subject', 'session.subject', input.subjectId)];
}

function booleanFact(observedAt: string, semanticKey: string, factType: string, value: boolean): EvidenceFact {
  return {
    semanticKey,
    observedAt,
    factType,
    value,
    confidence: 1,
    confidenceProvenance: 'rule-v1',
    rawPayloadRef: `protected:identity:${semanticKey}`,
    sensitivity: 'confidential',
    incomplete: false,
  };
}

function fact(observedAt: string, semanticKey: string, factType: string, value: string): EvidenceFact {
  return {
    semanticKey,
    observedAt,
    factType,
    value,
    confidence: 1,
    confidenceProvenance: 'provider',
    rawPayloadRef: `protected:identity:${semanticKey}`,
    sensitivity: 'confidential',
    incomplete: false,
  };
}
