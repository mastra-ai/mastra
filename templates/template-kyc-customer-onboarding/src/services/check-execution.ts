import type { TracingContext } from '@mastra/core/observability';
import { z } from 'zod';

import type { PiiProtectionPolicy } from '../contracts/policies/policies.js';
import type { PepScreeningProvider, SanctionsScreeningProvider } from '../contracts/providers/screening.js';
import type { AddressVerificationProvider, IdentityVerificationProvider } from '../contracts/providers/verification.js';
import type { ApplicationRepository } from '../contracts/repositories/application-repository.js';
import type { CaseRepository } from '../contracts/repositories/case-repository.js';
import type { DocumentExtractionRepository } from '../contracts/repositories/document-extraction-repository.js';
import type { EvidenceRepository } from '../contracts/repositories/evidence-repository.js';
import type { IdempotencyRepository } from '../contracts/repositories/idempotency-repository.js';
import { ProviderError, ProviderResultInvalidError } from '../contracts/shared/provider.js';
import type { Clock, ProviderMetricsRecorder } from '../contracts/technical/primitives.js';
import type { ScreeningPolicy } from '../config/policies/screening.js';
import { executionContextSchema } from '../domain/context.js';
import { DomainInvariantError, IdempotencyConflictError } from '../domain/errors.js';
import { evidenceItemSchema, type EvidenceItem } from '../domain/evidence.js';
import { caseIdSchema, documentIdSchema, idempotencyKeySchema, workflowRunIdSchema } from '../domain/identifiers.js';
import {
  screeningResultSchema,
  verificationResultSchema,
  type ScreeningResult,
  type VerificationResult,
} from '../domain/verification.js';
import { withKycProviderSpan } from '../observability/provider-span.js';
import { createStableIdentifier, fingerprintValue } from './stable-identifiers.js';

export const checkExecutionInputSchema = z
  .object({
    execution: executionContextSchema,
    caseId: caseIdSchema,
    documentId: documentIdSchema,
    idempotencyKey: idempotencyKeySchema,
    workflowRunId: workflowRunIdSchema,
    timeoutMs: z.number().int().min(100).max(120_000),
  })
  .strict();

export const verificationCheckOutputSchema = z
  .object({ result: verificationResultSchema, evidence: evidenceItemSchema })
  .strict();

export const screeningCheckOutputSchema = z
  .object({ result: screeningResultSchema, evidence: evidenceItemSchema })
  .strict();

export type CheckExecutionInput = z.infer<typeof checkExecutionInputSchema>;
export type VerificationCheckOutput = z.infer<typeof verificationCheckOutputSchema>;
export type ScreeningCheckOutput = z.infer<typeof screeningCheckOutputSchema>;

type CheckKind = 'IDENTITY' | 'ADDRESS' | 'SANCTIONS' | 'PEP';
type CheckResult = VerificationResult | ScreeningResult;

type ProviderDescriptor<Result extends CheckResult> = Readonly<{
  check: CheckKind;
  providerId: string;
  providerVersion: string;
  externalNetwork: boolean;
  acceptedPii: readonly (
    | 'NONE'
    | 'IDENTITY'
    | 'CONTACT'
    | 'ADDRESS'
    | 'DOCUMENT_METADATA'
    | 'DOCUMENT_CONTENT'
    | 'DOCUMENT_NUMBER'
    | 'DATE_OF_BIRTH'
    | 'SCREENING'
    | 'SECRET'
  )[];
  screeningPolicy: ScreeningPolicy;
  resultSchema: z.ZodType<Result>;
  invoke: (
    loaded: LoadedCheckData,
    input: CheckExecutionInput,
    idempotencyKey: string,
    deadlineAt: string,
  ) => Promise<Result>;
}>;

type LoadedCheckData = Readonly<{
  application: Awaited<ReturnType<ApplicationRepository['get']>>;
  extraction: Awaited<ReturnType<DocumentExtractionRepository['get']>>;
}>;

const checkOperation = (check: CheckKind): string => `KYC_${check}_CHECK_V1`;
const providerOperation = (check: CheckKind): string =>
  check === 'IDENTITY'
    ? 'IDENTITY_VERIFICATION'
    : check === 'ADDRESS'
      ? 'ADDRESS_VERIFICATION'
      : check === 'SANCTIONS'
        ? 'SANCTIONS_SCREENING'
        : 'PEP_SCREENING';
const workflowStepId = (check: CheckKind): string =>
  `${check.toLowerCase()}-${check === 'IDENTITY' || check === 'ADDRESS' ? 'verification' : 'screening'}-v1`;

const evidenceKind = (
  check: CheckKind,
  result: CheckResult,
):
  | 'IDENTITY_CHECK'
  | 'ADDRESS_CHECK'
  | 'SANCTIONS_CHECK'
  | 'PEP_CHECK'
  | 'SANCTIONS_CANDIDATE'
  | 'PEP_CANDIDATE'
  | 'PROVIDER_UNAVAILABLE' => {
  if (result.status === 'INCONCLUSIVE' || result.status === 'ERROR') return 'PROVIDER_UNAVAILABLE';
  if (check === 'IDENTITY') return 'IDENTITY_CHECK';
  if (check === 'ADDRESS') return 'ADDRESS_CHECK';
  if ('kind' in result && result.candidates.length > 0)
    return check === 'SANCTIONS' ? 'SANCTIONS_CANDIDATE' : 'PEP_CANDIDATE';
  return check === 'SANCTIONS' ? 'SANCTIONS_CHECK' : 'PEP_CHECK';
};

const attachEvidence = <Result extends CheckResult>(result: Result, evidenceId: string): Result => {
  if ('kind' in result) {
    return screeningResultSchema.parse({
      ...result,
      candidates: result.candidates.map(candidate => ({
        ...candidate,
        evidenceIds: [evidenceId],
      })),
    }) as Result;
  }
  return verificationResultSchema.parse({ ...result, evidenceIds: [evidenceId] }) as Result;
};

const createEvidence = (
  check: CheckKind,
  result: CheckResult,
  evidenceId: string,
  tenantId: string,
  caseId: string,
  policyVersion: string,
  screeningPolicy: ScreeningPolicy,
): EvidenceItem => {
  const candidateCount = 'kind' in result ? result.candidates.length : 0;
  const highestScore =
    'kind' in result && result.candidates.length > 0
      ? Math.max(...result.candidates.map(candidate => candidate.score))
      : null;
  return evidenceItemSchema.parse({
    id: evidenceId,
    tenantId,
    caseId,
    kind: evidenceKind(check, result),
    sourceId: result.providerId,
    sourceVersion: result.providerVersion,
    reasonCode: result.reasonCodes[0],
    reasonCodes: result.reasonCodes,
    summary: `${check.toLowerCase()} check completed with a fail-safe status`,
    occurredAt: result.completedAt,
    metadata: {
      checkKind: check,
      status: result.status,
      policyVersion,
      screeningPolicyVersion: screeningPolicy.version,
      candidateCount,
      highestScore,
      dataset: screeningPolicy.dataset,
      algorithm: screeningPolicy.algorithm,
    },
  });
};

const failureResult = <Result extends CheckResult>(
  descriptor: ProviderDescriptor<Result>,
  completedAt: string,
  reasonCode: string,
  status: 'INCONCLUSIVE' | 'ERROR',
): Result =>
  descriptor.resultSchema.parse(
    descriptor.check === 'SANCTIONS' || descriptor.check === 'PEP'
      ? {
          kind: descriptor.check,
          status,
          candidates: [],
          reasonCodes: [reasonCode],
          providerId: descriptor.providerId,
          providerVersion: descriptor.providerVersion,
          completedAt,
        }
      : {
          status,
          reasonCodes: [reasonCode],
          evidenceIds: [],
          providerId: descriptor.providerId,
          providerVersion: descriptor.providerVersion,
          completedAt,
        },
  );

class CheckExecutionCoordinator {
  constructor(
    private readonly cases: CaseRepository,
    private readonly applications: ApplicationRepository,
    private readonly extractions: DocumentExtractionRepository,
    private readonly evidence: EvidenceRepository,
    private readonly idempotency: IdempotencyRepository,
    private readonly piiPolicy: PiiProtectionPolicy,
    private readonly clock: Clock,
    private readonly externalProviderAllowlist: readonly string[],
    private readonly providerMetrics?: ProviderMetricsRecorder,
  ) {}

  execute<Result extends CheckResult>(
    rawInput: CheckExecutionInput,
    descriptor: ProviderDescriptor<Result>,
    tracingContext?: TracingContext,
  ): Promise<Readonly<{ result: Result; evidence: EvidenceItem }>> {
    const input = checkExecutionInputSchema.parse(rawInput);
    const compositeKey = `${descriptor.check.toLowerCase()}:${fingerprintValue({
      tenantId: input.execution.tenantId,
      caseId: input.caseId,
      runKey: input.idempotencyKey,
      check: descriptor.check,
      policy: input.execution.policy,
      providerId: descriptor.providerId,
      providerVersion: descriptor.providerVersion,
      screeningPolicyVersion: descriptor.screeningPolicy.version,
      dataset: descriptor.screeningPolicy.dataset,
      algorithm: descriptor.screeningPolicy.algorithm,
    })}`;
    return this.#execute(input, compositeKey, descriptor, tracingContext);
  }

  async #execute<Result extends CheckResult>(
    input: CheckExecutionInput,
    compositeKey: string,
    descriptor: ProviderDescriptor<Result>,
    tracingContext?: TracingContext,
  ): Promise<Readonly<{ result: Result; evidence: EvidenceItem }>> {
    const storedCase = await this.cases.get({
      tenantId: input.execution.tenantId,
      caseId: input.caseId,
    });
    if (storedCase.status !== 'CHECKING') throw new DomainInvariantError('Verification checks require a CHECKING case');
    if (
      storedCase.jurisdiction !== input.execution.jurisdiction ||
      storedCase.policyProfile !== input.execution.piiMode ||
      storedCase.policy.id !== input.execution.policy.id ||
      storedCase.policy.version !== input.execution.policy.version ||
      storedCase.policy.checksum !== input.execution.policy.checksum
    ) {
      throw new DomainInvariantError('Verification context does not match the pinned case policy');
    }
    const [application, extraction] = await Promise.all([
      this.applications.get({
        tenantId: input.execution.tenantId,
        applicationId: storedCase.applicationId,
      }),
      this.extractions.get({
        tenantId: input.execution.tenantId,
        documentId: input.documentId,
      }),
    ]);
    if (application.caseId !== input.caseId || extraction.caseId !== input.caseId)
      throw new DomainInvariantError('Check references do not belong to the requested case');
    if (
      !this.piiPolicy.allowsTransmission({
        mode: input.execution.piiMode,
        providerId: descriptor.providerId,
        externalNetwork: descriptor.externalNetwork,
        categories: [...descriptor.acceptedPii],
        explicitAllowlist: [...this.externalProviderAllowlist],
      })
    ) {
      throw new DomainInvariantError('PII policy denied verification transmission');
    }
    const requestFingerprint = fingerprintValue({
      tenantId: input.execution.tenantId,
      caseId: input.caseId,
      documentId: input.documentId,
      applicationVersion: application.version,
      extractionCreatedAt: extraction.createdAt,
      policy: input.execution.policy,
      providerId: descriptor.providerId,
      providerVersion: descriptor.providerVersion,
      screeningPolicyVersion: descriptor.screeningPolicy.version,
    });
    const operation = checkOperation(descriptor.check);
    const existing = await this.idempotency.get(input.execution.tenantId, operation, compositeKey);
    if (existing !== undefined && existing.requestFingerprint !== requestFingerprint)
      throw new IdempotencyConflictError();
    if (existing?.status === 'COMPLETED') {
      return this.#replay(existing.resultJson, compositeKey, descriptor);
    }
    if (existing?.status === 'RESERVED') {
      return this.#awaitReservation(input, compositeKey, requestFingerprint, descriptor, existing.createdAt);
    }
    const reservedAt = this.clock.now().toISOString();
    const reservation = await this.idempotency.reserve({
      tenantId: input.execution.tenantId,
      operation,
      key: compositeKey,
      requestFingerprint,
      createdAt: reservedAt,
    });
    if (!reservation.acquired) {
      if (reservation.record.status === 'COMPLETED')
        return this.#replay(reservation.record.resultJson, compositeKey, descriptor);
      return this.#awaitReservation(input, compositeKey, requestFingerprint, descriptor, reservation.record.createdAt);
    }
    const loaded = { application, extraction };
    const deadlineAt = new Date(this.clock.now().getTime() + input.timeoutMs).toISOString();
    let result: Result;
    let outcome: 'success' | 'timeout' | 'error' = 'success';
    try {
      const providerResult = await withKycProviderSpan(
        tracingContext,
        {
          providerId: descriptor.providerId,
          operation: providerOperation(descriptor.check),
          tenantRef: input.execution.tenantId,
          caseRef: input.caseId,
          attempt: 1,
        },
        () => descriptor.invoke(loaded, input, compositeKey, deadlineAt),
      );
      const parsed = descriptor.resultSchema.safeParse(providerResult);
      if (!parsed.success) {
        throw new ProviderResultInvalidError({
          providerId: descriptor.providerId,
          operation:
            descriptor.check === 'IDENTITY'
              ? 'IDENTITY_VERIFICATION'
              : descriptor.check === 'ADDRESS'
                ? 'ADDRESS_VERIFICATION'
                : descriptor.check === 'SANCTIONS'
                  ? 'SANCTIONS_SCREENING'
                  : 'PEP_SCREENING',
          safeMessage: 'The verification provider returned an invalid result',
        });
      }
      if (
        parsed.data.providerId !== descriptor.providerId ||
        parsed.data.providerVersion !== descriptor.providerVersion
      ) {
        throw new ProviderResultInvalidError({
          providerId: descriptor.providerId,
          operation:
            descriptor.check === 'IDENTITY'
              ? 'IDENTITY_VERIFICATION'
              : descriptor.check === 'ADDRESS'
                ? 'ADDRESS_VERIFICATION'
                : descriptor.check === 'SANCTIONS'
                  ? 'SANCTIONS_SCREENING'
                  : 'PEP_SCREENING',
          safeMessage: 'The verification provider returned inconsistent identity metadata',
        });
      }
      if (
        (descriptor.check === 'SANCTIONS' || descriptor.check === 'PEP') &&
        'kind' in parsed.data &&
        parsed.data.kind !== descriptor.check
      ) {
        throw new ProviderResultInvalidError({
          providerId: descriptor.providerId,
          operation: descriptor.check === 'SANCTIONS' ? 'SANCTIONS_SCREENING' : 'PEP_SCREENING',
          safeMessage: 'The screening provider returned an inconsistent screening kind',
        });
      }
      result = parsed.data;
      if (result.status === 'ERROR' || result.status === 'INCONCLUSIVE') outcome = 'error';
    } catch (error) {
      const providerError = error instanceof ProviderError ? error : undefined;
      outcome = providerError?.details.code === 'PROVIDER_TIMEOUT' ? 'timeout' : 'error';
      result = failureResult(
        descriptor,
        this.clock.now().toISOString(),
        providerError?.details.code ?? 'PROVIDER_UNAVAILABLE',
        providerError === undefined || providerError.details.retryable ? 'INCONCLUSIVE' : 'ERROR',
      );
    }
    await this.providerMetrics
      ?.recordProvider({
        tenantId: input.execution.tenantId,
        eventId: `provider:${compositeKey}`,
        caseId: input.caseId,
        providerId: descriptor.providerId,
        operation: checkOperation(descriptor.check),
        outcome,
        startedAt: reservedAt,
        completedAt: result.completedAt,
        attemptCount: 1,
        retryCount: 0,
      })
      .catch(() => undefined);
    await this.providerMetrics
      ?.recordWorkflowStep?.({
        tenantId: input.execution.tenantId,
        eventId: `workflow-step:${compositeKey}`,
        caseId: input.caseId,
        workflowId: 'kyc-application-intake-v1',
        runId: input.workflowRunId,
        stepId: workflowStepId(descriptor.check),
        outcome: outcome === 'success' ? 'success' : 'error',
        startedAt: reservedAt,
        completedAt: result.completedAt,
      })
      .catch(() => undefined);
    return this.#persist(input, compositeKey, requestFingerprint, descriptor, result, reservedAt);
  }

  async #replay<Result extends CheckResult>(
    resultJson: string | null,
    compositeKey: string,
    descriptor: ProviderDescriptor<Result>,
  ): Promise<Readonly<{ result: Result; evidence: EvidenceItem }>> {
    const replay = z
      .object({ result: descriptor.resultSchema, evidence: evidenceItemSchema })
      .strict()
      .parse(JSON.parse(z.string().parse(resultJson)));
    await this.evidence.append({
      evidence: replay.evidence,
      idempotencyKey: `${compositeKey}:evidence`,
    });
    return replay;
  }

  async #awaitReservation<Result extends CheckResult>(
    input: CheckExecutionInput,
    compositeKey: string,
    requestFingerprint: string,
    descriptor: ProviderDescriptor<Result>,
    reservationCreatedAt: string,
  ): Promise<Readonly<{ result: Result; evidence: EvidenceItem }>> {
    const operation = checkOperation(descriptor.check);
    const waitUntil = Date.now() + input.timeoutMs;
    while (Date.now() < waitUntil) {
      await new Promise<void>(resolve => setTimeout(resolve, 10));
      const record = await this.idempotency.get(input.execution.tenantId, operation, compositeKey);
      if (record?.requestFingerprint !== requestFingerprint) throw new IdempotencyConflictError();
      if (record.status === 'COMPLETED') return this.#replay(record.resultJson, compositeKey, descriptor);
    }
    return this.#persistFailure(
      input,
      compositeKey,
      requestFingerprint,
      descriptor,
      'IDEMPOTENCY_RESERVATION_INCOMPLETE',
      'INCONCLUSIVE',
      this.clock.now().toISOString(),
      reservationCreatedAt,
    );
  }

  #persistFailure<Result extends CheckResult>(
    input: CheckExecutionInput,
    compositeKey: string,
    requestFingerprint: string,
    descriptor: ProviderDescriptor<Result>,
    reasonCode: string,
    status: 'INCONCLUSIVE' | 'ERROR',
    completedAt: string,
    reservationCreatedAt: string,
  ) {
    return this.#persist(
      input,
      compositeKey,
      requestFingerprint,
      descriptor,
      failureResult(descriptor, completedAt, reasonCode, status),
      reservationCreatedAt,
    );
  }

  async #persist<Result extends CheckResult>(
    input: CheckExecutionInput,
    compositeKey: string,
    requestFingerprint: string,
    descriptor: ProviderDescriptor<Result>,
    providerResult: Result,
    reservationCreatedAt: string,
  ): Promise<Readonly<{ result: Result; evidence: EvidenceItem }>> {
    const evidenceId = createStableIdentifier('evidence', input.execution.tenantId, compositeKey);
    const result = attachEvidence(providerResult, evidenceId);
    const evidence = createEvidence(
      descriptor.check,
      result,
      evidenceId,
      input.execution.tenantId,
      input.caseId,
      input.execution.policy.version,
      descriptor.screeningPolicy,
    );
    const output = { result, evidence };
    await this.idempotency.complete({
      tenantId: input.execution.tenantId,
      operation: checkOperation(descriptor.check),
      key: compositeKey,
      requestFingerprint,
      resultJson: JSON.stringify(output),
      completedAt: result.completedAt,
      createdAt: reservationCreatedAt,
    });
    await this.evidence.append({
      evidence,
      idempotencyKey: `${compositeKey}:evidence`,
    });
    return output;
  }
}

type SharedDependencies = ConstructorParameters<typeof CheckExecutionCoordinator>;

export class IdentityVerificationService {
  readonly #coordinator: CheckExecutionCoordinator;
  constructor(
    private readonly provider: IdentityVerificationProvider,
    private readonly screeningPolicy: ScreeningPolicy,
    ...dependencies: SharedDependencies
  ) {
    this.#coordinator = new CheckExecutionCoordinator(...dependencies);
  }
  execute(input: CheckExecutionInput, tracingContext?: TracingContext): Promise<VerificationCheckOutput> {
    return this.#coordinator.execute(
      input,
      {
        check: 'IDENTITY',
        providerId: this.provider.id,
        providerVersion: this.provider.version,
        externalNetwork: this.provider.capabilities.externalNetwork,
        acceptedPii: this.provider.capabilities.acceptedPii,
        screeningPolicy: this.screeningPolicy,
        resultSchema: verificationResultSchema,
        invoke: (loaded, value, idempotencyKey, deadlineAt) =>
          this.provider.verify(
            {
              caseId: value.caseId,
              applicationFullName: loaded.application.data.fullName,
              extractedFullName: loaded.extraction.result.fields.fullName.normalizedValue,
              jurisdiction: value.execution.jurisdiction,
              policyVersion: value.execution.policy.version,
            },
            { execution: value.execution, deadlineAt, attempt: 1, idempotencyKey },
          ),
      },
      tracingContext,
    );
  }
}

export class AddressVerificationService {
  readonly #coordinator: CheckExecutionCoordinator;
  constructor(
    private readonly provider: AddressVerificationProvider,
    private readonly screeningPolicy: ScreeningPolicy,
    ...dependencies: SharedDependencies
  ) {
    this.#coordinator = new CheckExecutionCoordinator(...dependencies);
  }
  execute(input: CheckExecutionInput, tracingContext?: TracingContext): Promise<VerificationCheckOutput> {
    return this.#coordinator.execute(
      input,
      {
        check: 'ADDRESS',
        providerId: this.provider.id,
        providerVersion: this.provider.version,
        externalNetwork: this.provider.capabilities.externalNetwork,
        acceptedPii: this.provider.capabilities.acceptedPii,
        screeningPolicy: this.screeningPolicy,
        resultSchema: verificationResultSchema,
        invoke: (loaded, value, idempotencyKey, deadlineAt) =>
          this.provider.verify(
            {
              caseId: value.caseId,
              applicationAddress: loaded.application.data.residentialAddress,
              extractedAddress: loaded.extraction.result.fields.residentialAddress.originalValue,
              jurisdiction: value.execution.jurisdiction,
              policyVersion: value.execution.policy.version,
            },
            { execution: value.execution, deadlineAt, attempt: 1, idempotencyKey },
          ),
      },
      tracingContext,
    );
  }
}

const aliasesFrom = (loaded: LoadedCheckData): string[] => {
  const primary = loaded.application.data.fullName.trim().toUpperCase();
  return [
    loaded.extraction.result.fields.fullName.normalizedValue,
    loaded.extraction.result.fields.fullName.originalValue,
  ]
    .filter((value): value is string => value !== null)
    .map(value => value.trim())
    .filter(
      (value, index, values) =>
        value.length > 0 &&
        value.toUpperCase() !== primary &&
        values.findIndex(candidate => candidate.toUpperCase() === value.toUpperCase()) === index,
    );
};

export class SanctionsScreeningService {
  readonly #coordinator: CheckExecutionCoordinator;
  constructor(
    private readonly provider: SanctionsScreeningProvider,
    private readonly screeningPolicy: ScreeningPolicy,
    ...dependencies: SharedDependencies
  ) {
    this.#coordinator = new CheckExecutionCoordinator(...dependencies);
  }
  execute(input: CheckExecutionInput, tracingContext?: TracingContext): Promise<ScreeningCheckOutput> {
    return this.#coordinator.execute(
      input,
      {
        check: 'SANCTIONS',
        providerId: this.provider.id,
        providerVersion: this.provider.version,
        externalNetwork: this.provider.capabilities.externalNetwork,
        acceptedPii: this.provider.capabilities.acceptedPii,
        screeningPolicy: this.screeningPolicy,
        resultSchema: screeningResultSchema,
        invoke: (loaded, value, idempotencyKey, deadlineAt) =>
          this.provider.screen(
            {
              caseId: value.caseId,
              fullName: loaded.application.data.fullName,
              aliases: aliasesFrom(loaded),
              dateOfBirth: loaded.application.data.dateOfBirth,
              nationality: loaded.application.data.nationality,
              jurisdiction: value.execution.jurisdiction,
              policyVersion: value.execution.policy.version,
            },
            { execution: value.execution, deadlineAt, attempt: 1, idempotencyKey },
          ),
      },
      tracingContext,
    );
  }
}

export class PepScreeningService {
  readonly #coordinator: CheckExecutionCoordinator;
  constructor(
    private readonly provider: PepScreeningProvider,
    private readonly screeningPolicy: ScreeningPolicy,
    ...dependencies: SharedDependencies
  ) {
    this.#coordinator = new CheckExecutionCoordinator(...dependencies);
  }
  execute(input: CheckExecutionInput, tracingContext?: TracingContext): Promise<ScreeningCheckOutput> {
    return this.#coordinator.execute(
      input,
      {
        check: 'PEP',
        providerId: this.provider.id,
        providerVersion: this.provider.version,
        externalNetwork: this.provider.capabilities.externalNetwork,
        acceptedPii: this.provider.capabilities.acceptedPii,
        screeningPolicy: this.screeningPolicy,
        resultSchema: screeningResultSchema,
        invoke: (loaded, value, idempotencyKey, deadlineAt) =>
          this.provider.screen(
            {
              caseId: value.caseId,
              fullName: loaded.application.data.fullName,
              aliases: aliasesFrom(loaded),
              dateOfBirth: loaded.application.data.dateOfBirth,
              nationality: loaded.application.data.nationality,
              jurisdiction: value.execution.jurisdiction,
              policyVersion: value.execution.policy.version,
            },
            { execution: value.execution, deadlineAt, attempt: 1, idempotencyKey },
          ),
      },
      tracingContext,
    );
  }
}
