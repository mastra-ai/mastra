import type {
  PepScreeningProvider,
  SanctionsScreeningProvider,
  ScreeningInput,
  ScreeningProviderResult,
} from '../../contracts/providers/screening.js';
import { screeningInputSchema } from '../../contracts/providers/screening.js';
import type { ProviderExecutionContext } from '../../contracts/shared/execution-context.js';
import {
  ProviderError,
  ProviderResultInvalidError,
  type ProviderCapabilities,
} from '../../contracts/shared/provider.js';
import type { Clock, ProviderMetricsRecorder } from '../../contracts/technical/primitives.js';
import type { ScreeningPolicy } from '../../config/policies/screening.js';
import { classifyScreeningScore } from '../../config/policies/screening.js';
import { screeningResultSchema } from '../../domain/verification.js';
import { parseProviderBoundary, parseProviderResult } from '../local/provider-validation.js';
import type { OpenSanctionsGateway } from './opensanctions-gateway.js';

const capabilities = (operation: 'SANCTIONS_SCREENING' | 'PEP_SCREENING'): ProviderCapabilities =>
  Object.freeze({
    operations: [operation],
    environments: ['test', 'demo-default', 'demo-strict', 'live'],
    externalNetwork: true,
    idempotent: false,
    supportedPiiModes: ['demo-default', 'demo-strict'],
    acceptedPii: ['IDENTITY', 'DATE_OF_BIRTH', 'SCREENING'],
    documentMimeTypes: [],
    jurisdictions: ['US'],
  } satisfies ProviderCapabilities);

export const openSanctionsSanctionsCapabilities = capabilities('SANCTIONS_SCREENING');
export const openSanctionsPepCapabilities = capabilities('PEP_SCREENING');

const screen = async (
  providerId: string,
  kind: 'SANCTIONS' | 'PEP',
  operation: 'SANCTIONS_SCREENING' | 'PEP_SCREENING',
  input: ScreeningInput,
  context: ProviderExecutionContext,
  gateway: OpenSanctionsGateway,
  policy: ScreeningPolicy,
  maxAttempts: number,
  clock: Clock,
  providerMetrics?: ProviderMetricsRecorder,
): Promise<ScreeningProviderResult> => {
  const boundary = parseProviderBoundary(screeningInputSchema, input, context, {
    providerId,
    operation,
  });
  const scope = kind === 'SANCTIONS' ? policy.sanctions : policy.pep;
  const startedAt = clock.now().toISOString();
  const metricEventId =
    boundary.context.idempotencyKey === undefined ? undefined : `provider:${boundary.context.idempotencyKey}`;
  let gatewayResult: Awaited<ReturnType<OpenSanctionsGateway['match']>>;
  try {
    gatewayResult = await gateway.match({
      providerId,
      operation,
      kind,
      policy,
      maxAttempts,
      deadlineAt: boundary.context.deadlineAt,
      input: {
        fullName: boundary.input.fullName,
        aliases: boundary.input.aliases,
        dateOfBirth: boundary.input.dateOfBirth,
        nationality: boundary.input.nationality,
      },
    });
  } catch (error) {
    const completedAt = clock.now().toISOString();
    const recordedAttempts = error instanceof ProviderError ? error.details.metadata.attemptCount : undefined;
    const attemptCount = typeof recordedAttempts === 'number' ? Math.max(1, recordedAttempts) : 1;
    if (providerMetrics !== undefined && metricEventId !== undefined) {
      await providerMetrics
        .recordProvider({
          tenantId: boundary.context.execution.tenantId,
          eventId: metricEventId,
          caseId: boundary.input.caseId,
          providerId,
          operation,
          outcome: error instanceof ProviderError && error.details.code === 'PROVIDER_TIMEOUT' ? 'timeout' : 'error',
          startedAt,
          completedAt,
          attemptCount,
          retryCount: attemptCount - 1,
        })
        .catch(() => undefined);
    }
    throw error;
  }
  const gatewayCandidates = gatewayResult.candidates;
  if (gatewayCandidates.some(candidate => !candidate.topics.some(topic => scope.topics.includes(topic)))) {
    throw new ProviderResultInvalidError({
      providerId,
      operation,
      safeMessage: 'The screening provider returned a candidate outside the requested scope',
    });
  }
  const materialCandidates = gatewayCandidates
    .map(candidate => ({
      ...candidate,
      topics: candidate.topics.filter(topic => scope.topics.includes(topic)),
      classification: classifyScreeningScore(candidate.score, scope),
    }))
    .filter(
      (candidate): candidate is typeof candidate & { classification: 'POSSIBLE' | 'STRONG_REVIEW' } =>
        candidate.classification !== 'NO_MATERIAL_MATCH' &&
        candidate.topics.some(topic => scope.topics.includes(topic)),
    );
  const deduplicatedCandidates = new Map<string, (typeof materialCandidates)[number]>();
  for (const candidate of materialCandidates) {
    const existing = deduplicatedCandidates.get(candidate.candidateId);
    if (existing === undefined || candidate.score > existing.score) {
      deduplicatedCandidates.set(candidate.candidateId, candidate);
    }
  }
  const candidates = [...deduplicatedCandidates.values()]
    .sort((left, right) => right.score - left.score || left.candidateId.localeCompare(right.candidateId))
    .slice(0, policy.limit)
    .map(candidate => ({ ...candidate, evidenceIds: [] }));
  const strong = candidates.some(candidate => candidate.classification === 'STRONG_REVIEW');
  const completedAt = clock.now().toISOString();
  const result = parseProviderResult(
    screeningResultSchema,
    {
      kind,
      status: strong ? 'STRONG_CANDIDATE' : candidates.length > 0 ? 'POSSIBLE_MATCH' : 'CLEAR',
      candidates,
      reasonCodes: [
        strong ? 'STRONG_REVIEW_CANDIDATE' : candidates.length > 0 ? 'POSSIBLE_MATCH_CANDIDATE' : 'NO_MATERIAL_MATCH',
      ],
      providerId,
      providerVersion: '2026-08-21',
      completedAt,
    },
    { providerId, operation },
  );
  if (providerMetrics !== undefined && metricEventId !== undefined) {
    await providerMetrics
      .recordProvider({
        tenantId: boundary.context.execution.tenantId,
        eventId: metricEventId,
        caseId: boundary.input.caseId,
        providerId,
        operation,
        outcome: 'success',
        startedAt,
        completedAt,
        attemptCount: gatewayResult.attemptCount,
        retryCount: gatewayResult.attemptCount - 1,
      })
      .catch(() => undefined);
  }
  return result;
};

export class OpenSanctionsSanctionsScreeningProvider implements SanctionsScreeningProvider {
  readonly id = 'opensanctions-sanctions';
  readonly version = '2026-08-21';
  readonly capabilities = openSanctionsSanctionsCapabilities;

  constructor(
    private readonly gateway: OpenSanctionsGateway,
    private readonly policy: ScreeningPolicy,
    private readonly maxAttempts: number,
    private readonly clock: Clock,
    private readonly providerMetrics?: ProviderMetricsRecorder,
  ) {}

  screen(input: ScreeningInput, context: ProviderExecutionContext): Promise<ScreeningProviderResult> {
    return screen(
      this.id,
      'SANCTIONS',
      'SANCTIONS_SCREENING',
      input,
      context,
      this.gateway,
      this.policy,
      this.maxAttempts,
      this.clock,
      this.providerMetrics,
    );
  }
}

export class OpenSanctionsPepScreeningProvider implements PepScreeningProvider {
  readonly id = 'opensanctions-pep';
  readonly version = '2026-08-21';
  readonly capabilities = openSanctionsPepCapabilities;

  constructor(
    private readonly gateway: OpenSanctionsGateway,
    private readonly policy: ScreeningPolicy,
    private readonly maxAttempts: number,
    private readonly clock: Clock,
    private readonly providerMetrics?: ProviderMetricsRecorder,
  ) {}

  screen(input: ScreeningInput, context: ProviderExecutionContext): Promise<ScreeningProviderResult> {
    return screen(
      this.id,
      'PEP',
      'PEP_SCREENING',
      input,
      context,
      this.gateway,
      this.policy,
      this.maxAttempts,
      this.clock,
      this.providerMetrics,
    );
  }
}
