import type { TracingContext } from '@mastra/core/observability';
import { z } from 'zod';

import type { MultimodalDocumentExtractionProvider } from '../contracts/providers/document-extraction.js';
import { documentExtractionResultSchema } from '../contracts/providers/document-extraction.js';
import type { PiiProtectionPolicy } from '../contracts/policies/policies.js';
import type { DocumentExtractionRepository } from '../contracts/repositories/document-extraction-repository.js';
import type { EvidenceRepository } from '../contracts/repositories/evidence-repository.js';
import type { IdempotencyRepository } from '../contracts/repositories/idempotency-repository.js';
import type { Clock, CostRecorder, ProviderMetricsRecorder } from '../contracts/technical/primitives.js';
import { ProviderError, ProviderResultInvalidError } from '../contracts/shared/provider.js';
import { loadDocumentExtractionPrompt } from '../config/prompts/load-document-extraction-prompt.js';
import { executionContextSchema } from '../domain/context.js';
import { identityDocumentSchema } from '../domain/documents.js';
import { DomainInvariantError, NotFoundError, PersistenceConflictError } from '../domain/errors.js';
import { evidenceItemSchema } from '../domain/evidence.js';
import { idempotencyKeySchema, modelIdSchema, workflowRunIdSchema } from '../domain/identifiers.js';
import { withKycProviderSpan } from '../observability/provider-span.js';
import { createStableIdentifier, fingerprintValue } from './stable-identifiers.js';

export const extractStoredDocumentInputSchema = z
  .object({
    execution: executionContextSchema,
    document: identityDocumentSchema,
    modelId: modelIdSchema,
    schemaVersion: z.string().min(1).max(64),
    timeoutMs: z.number().int().min(100).max(120_000),
    idempotencyKey: idempotencyKeySchema,
    workflowRunId: workflowRunIdSchema,
  })
  .strict();

export const extractStoredDocumentResultSchema = z
  .object({
    extraction: documentExtractionResultSchema,
    evidence: evidenceItemSchema,
  })
  .strict();

const extractionExecutions = new Map<string, Promise<void>>();
const invocationOperation = 'DOCUMENT_EXTRACTION_INVOCATION_V1';
const failureOperation = 'DOCUMENT_EXTRACTION_FAILURE_V1';

const serializeExtraction = async <Result>(key: string, operation: () => Promise<Result>): Promise<Result> => {
  const previous = extractionExecutions.get(key) ?? Promise.resolve();
  let release = (): void => undefined;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const queued = previous.then(() => gate);
  extractionExecutions.set(key, queued);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (extractionExecutions.get(key) === queued) extractionExecutions.delete(key);
  }
};

export class DocumentExtractionService {
  constructor(
    private readonly provider: MultimodalDocumentExtractionProvider,
    private readonly piiPolicy: PiiProtectionPolicy,
    private readonly extractions: DocumentExtractionRepository,
    private readonly evidence: EvidenceRepository,
    private readonly idempotency: IdempotencyRepository,
    private readonly costRecorder: CostRecorder,
    private readonly clock: Clock,
    private readonly externalProviderAllowlist: readonly string[],
    private readonly providerMetrics?: ProviderMetricsRecorder,
  ) {}

  async extract(rawInput: z.infer<typeof extractStoredDocumentInputSchema>, tracingContext?: TracingContext) {
    const input = extractStoredDocumentInputSchema.parse(rawInput);
    return serializeExtraction(`${input.execution.tenantId}:${input.idempotencyKey}`, () =>
      this.#extract(input, tracingContext),
    );
  }

  async #extract(input: z.infer<typeof extractStoredDocumentInputSchema>, tracingContext?: TracingContext) {
    if (
      !this.piiPolicy.allowsTransmission({
        mode: input.execution.piiMode,
        providerId: this.provider.id,
        externalNetwork: this.provider.capabilities.externalNetwork,
        categories: this.provider.capabilities.acceptedPii,
        explicitAllowlist: [...this.externalProviderAllowlist],
      })
    ) {
      throw new DomainInvariantError('PII policy denied document extraction transmission');
    }
    const startedAt = this.clock.now();
    const metricInvocationRef = fingerprintValue({
      tenantId: input.execution.tenantId,
      documentId: input.document.id,
      idempotencyKey: input.idempotencyKey,
      providerId: this.provider.id,
      operation: 'DOCUMENT_EXTRACTION',
    });
    const prompt = loadDocumentExtractionPrompt();
    const requestFingerprint = fingerprintValue({
      document: input.document.content,
      providerId: this.provider.id,
      schemaVersion: input.schemaVersion,
      promptVersion: prompt.version,
      modelId: input.modelId,
    });
    const invocation = {
      tenantId: input.execution.tenantId,
      operation: invocationOperation,
      key: input.idempotencyKey,
      requestFingerprint,
    };
    const reservation = await this.idempotency.reserve({
      ...invocation,
      createdAt: startedAt.toISOString(),
    });
    let leaseCreatedAt = reservation.record.createdAt;
    if (!reservation.acquired) {
      if (reservation.record.status === 'COMPLETED') return this.#restoreCompleted(input, metricInvocationRef);
      const completed = await this.#waitForCompletion(input, requestFingerprint);
      if (completed) return this.#restoreCompleted(input, metricInvocationRef);
      const reacquired = await this.idempotency.reacquireExpired({
        ...invocation,
        createdAt: this.clock.now().toISOString(),
        expiredBefore: new Date(this.clock.now().getTime() - input.timeoutMs).toISOString(),
      });
      if (!reacquired.acquired) {
        if (reacquired.record.status === 'COMPLETED') return this.#restoreCompleted(input, metricInvocationRef);
        throw new PersistenceConflictError('Document extraction invocation');
      }
      leaseCreatedAt = reacquired.record.createdAt;
    }
    const recovered = await this.#getPersisted(input);
    if (recovered !== undefined) {
      const result = await this.#finalize(input, recovered, metricInvocationRef);
      await this.#completeInvocation(input, requestFingerprint, result.evidence.id, leaseCreatedAt);
      return result;
    }
    const renewedAt = new Date(
      Math.max(this.clock.now().getTime(), new Date(leaseCreatedAt).getTime() + 1),
    ).toISOString();
    const renewed = await this.idempotency.reacquireExpired({
      ...invocation,
      createdAt: renewedAt,
      expiredBefore: leaseCreatedAt,
    });
    if (!renewed.acquired) {
      if (renewed.record.status === 'COMPLETED') return this.#restoreCompleted(input, metricInvocationRef);
      throw new PersistenceConflictError('Document extraction invocation');
    }
    leaseCreatedAt = renewed.record.createdAt;
    const providerStartedAt = this.clock.now();
    const providerDeadlineAt = new Date(
      Math.min(providerStartedAt.getTime() + input.timeoutMs, new Date(leaseCreatedAt).getTime() + input.timeoutMs),
    );
    if (providerDeadlineAt.getTime() <= providerStartedAt.getTime()) {
      await this.idempotency.abandon({ ...invocation, createdAt: leaseCreatedAt });
      throw new PersistenceConflictError('Document extraction invocation');
    }
    let parsedProviderOutput: ReturnType<typeof documentExtractionResultSchema.safeParse>;
    try {
      const providerOutput = await withKycProviderSpan(
        tracingContext,
        {
          providerId: this.provider.id,
          operation: 'DOCUMENT_EXTRACTION',
          tenantRef: input.execution.tenantId,
          caseRef: input.document.caseId,
          attempt: 1,
        },
        () =>
          this.provider.extract(
            {
              caseId: input.document.caseId,
              documentId: input.document.id,
              documentTypeHint: input.document.type,
              document: input.document.content,
              jurisdiction: input.execution.jurisdiction,
              schemaVersion: input.schemaVersion,
            },
            {
              execution: input.execution,
              deadlineAt: providerDeadlineAt.toISOString(),
              attempt: 1,
              idempotencyKey: input.idempotencyKey,
            },
          ),
      );
      parsedProviderOutput = documentExtractionResultSchema.safeParse(providerOutput);
      if (!parsedProviderOutput.success) {
        throw new ProviderResultInvalidError({
          providerId: this.provider.id,
          operation: 'DOCUMENT_EXTRACTION',
          safeMessage: 'The document extraction provider returned an invalid result',
        });
      }
    } catch (error) {
      const completedAt = this.clock.now().toISOString();
      await this.providerMetrics
        ?.recordProvider({
          tenantId: input.execution.tenantId,
          eventId: `provider:${metricInvocationRef}:failure`,
          caseId: input.document.caseId,
          providerId: this.provider.id,
          operation: 'DOCUMENT_EXTRACTION',
          outcome: error instanceof ProviderError && error.details.code === 'PROVIDER_TIMEOUT' ? 'timeout' : 'error',
          startedAt: providerStartedAt.toISOString(),
          completedAt,
          attemptCount: 1,
          retryCount: 0,
        })
        .catch(() => undefined);
      await this.providerMetrics
        ?.recordWorkflowStep?.({
          tenantId: input.execution.tenantId,
          eventId: `workflow-step:${metricInvocationRef}:failure`,
          caseId: input.document.caseId,
          workflowId: 'kyc-application-intake-v1',
          runId: input.workflowRunId,
          stepId: 'extract-structured-document-v1',
          outcome: 'error',
          startedAt: providerStartedAt.toISOString(),
          completedAt,
        })
        .catch(() => undefined);
      await this.#markFailure(input, requestFingerprint, completedAt);
      await this.idempotency.abandon({ ...invocation, createdAt: leaseCreatedAt });
      throw error;
    }
    const extraction = parsedProviderOutput.data;
    const completedAt = this.clock.now();
    const persistedExtraction = await this.extractions.put({
      extraction: {
        tenantId: input.execution.tenantId,
        caseId: input.document.caseId,
        documentId: input.document.id,
        schemaVersion: input.schemaVersion,
        promptVersion: prompt.version,
        modelId: input.modelId,
        result: extraction,
        createdAt: completedAt.toISOString(),
      },
      idempotencyKey: `${input.idempotencyKey}:result`,
      requestFingerprint,
    });
    const result = await this.#finalize(input, persistedExtraction, metricInvocationRef);
    await this.#completeInvocation(input, requestFingerprint, result.evidence.id, leaseCreatedAt);
    return result;
  }

  async #finalize(
    input: z.infer<typeof extractStoredDocumentInputSchema>,
    persistedExtraction: Awaited<ReturnType<DocumentExtractionRepository['get']>>,
    metricInvocationRef: string,
  ) {
    const prompt = loadDocumentExtractionPrompt();
    if (
      persistedExtraction.schemaVersion !== input.schemaVersion ||
      persistedExtraction.promptVersion !== prompt.version ||
      persistedExtraction.modelId !== input.modelId ||
      persistedExtraction.result.provider.providerId !== this.provider.id
    )
      throw new DomainInvariantError('Persisted document extraction does not match the invocation');
    const canonicalExtraction = persistedExtraction.result;
    const canonicalStartedAt = new Date(canonicalExtraction.provider.startedAt);
    const canonicalCompletedAt = new Date(canonicalExtraction.provider.completedAt);
    const evidence = evidenceItemSchema.parse({
      id: createStableIdentifier('evidence', input.execution.tenantId, input.idempotencyKey),
      tenantId: input.execution.tenantId,
      caseId: input.document.caseId,
      kind: 'DOCUMENT_EXTRACTION',
      sourceId: canonicalExtraction.provider.providerId,
      sourceVersion: canonicalExtraction.provider.providerVersion,
      reasonCode: canonicalExtraction.quality === 'UNREADABLE' ? 'DOCUMENT_UNREADABLE' : 'DOCUMENT_EXTRACTED',
      summary:
        canonicalExtraction.quality === 'UNREADABLE'
          ? 'The synthetic document could not be read'
          : 'Structured fields were extracted from the synthetic document',
      occurredAt: canonicalCompletedAt.toISOString(),
      metadata: {
        quality: canonicalExtraction.quality,
        missingFieldCount: canonicalExtraction.missingFields.length,
        warningCount: canonicalExtraction.warnings.length,
        schemaVersion: input.schemaVersion,
        promptVersion: prompt.version,
      },
    });
    await this.evidence.append({
      evidence,
      idempotencyKey: `${input.idempotencyKey}:evidence`,
    });
    await this.costRecorder
      .record({
        tenantId: input.execution.tenantId,
        caseId: input.document.caseId,
        usageEventId: `${metricInvocationRef}:success`,
        providerId: canonicalExtraction.provider.providerId,
        operation: 'DOCUMENT_EXTRACTION',
        inputUnits: canonicalExtraction.usage?.inputUnits ?? 0,
        outputUnits: canonicalExtraction.usage?.outputUnits ?? 0,
        estimatedCostUsd: canonicalExtraction.usage?.estimatedCostUsd ?? 0,
        priceVersion: canonicalExtraction.usage?.priceVersion ?? 'fixture-zero-v1',
        latencyMs: Math.max(0, canonicalCompletedAt.getTime() - canonicalStartedAt.getTime()),
        ...((await this.#hasFailure(input)) ? { attemptCount: 2, retryCount: 1 } : {}),
        recordedAt: canonicalCompletedAt.toISOString(),
      })
      .catch(() => undefined);
    await this.providerMetrics
      ?.recordWorkflowStep?.({
        tenantId: input.execution.tenantId,
        eventId: `workflow-step:${metricInvocationRef}:success`,
        caseId: input.document.caseId,
        workflowId: 'kyc-application-intake-v1',
        runId: input.workflowRunId,
        stepId: 'extract-structured-document-v1',
        outcome: 'success',
        startedAt: canonicalStartedAt.toISOString(),
        completedAt: canonicalCompletedAt.toISOString(),
      })
      .catch(() => undefined);
    return extractStoredDocumentResultSchema.parse({ extraction: canonicalExtraction, evidence });
  }

  async #getPersisted(input: z.infer<typeof extractStoredDocumentInputSchema>) {
    try {
      return await this.extractions.get({
        tenantId: input.execution.tenantId,
        documentId: input.document.id,
      });
    } catch (error) {
      if (error instanceof NotFoundError) return undefined;
      throw error;
    }
  }

  async #restoreCompleted(input: z.infer<typeof extractStoredDocumentInputSchema>, metricInvocationRef: string) {
    const persisted = await this.#getPersisted(input);
    if (persisted === undefined) throw new PersistenceConflictError('Completed document extraction');
    return this.#finalize(input, persisted, metricInvocationRef);
  }

  async #waitForCompletion(input: z.infer<typeof extractStoredDocumentInputSchema>, requestFingerprint: string) {
    const deadline = Date.now() + input.timeoutMs;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 20));
      const record = await this.idempotency.get(input.execution.tenantId, invocationOperation, input.idempotencyKey);
      if (record?.requestFingerprint !== requestFingerprint) return false;
      if (record.status === 'COMPLETED') return true;
    }
    return false;
  }

  async #markFailure(
    input: z.infer<typeof extractStoredDocumentInputSchema>,
    requestFingerprint: string,
    completedAt: string,
  ) {
    const marker = {
      tenantId: input.execution.tenantId,
      operation: failureOperation,
      key: input.idempotencyKey,
      requestFingerprint,
      createdAt: completedAt,
    };
    const reservation = await this.idempotency.reserve(marker);
    await this.idempotency.complete({
      ...marker,
      createdAt: reservation.record.createdAt,
      resultJson: JSON.stringify({ failed: true }),
      completedAt,
    });
  }

  async #hasFailure(input: z.infer<typeof extractStoredDocumentInputSchema>) {
    const marker = await this.idempotency.get(input.execution.tenantId, failureOperation, input.idempotencyKey);
    return marker?.status === 'COMPLETED';
  }

  async #completeInvocation(
    input: z.infer<typeof extractStoredDocumentInputSchema>,
    requestFingerprint: string,
    evidenceId: string,
    leaseCreatedAt: string,
  ) {
    await this.idempotency.complete({
      tenantId: input.execution.tenantId,
      operation: invocationOperation,
      key: input.idempotencyKey,
      requestFingerprint,
      resultJson: JSON.stringify({ documentId: input.document.id, evidenceId }),
      createdAt: leaseCreatedAt,
      completedAt: this.clock.now().toISOString(),
    });
  }
}
