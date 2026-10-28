import { createHash } from 'node:crypto';

import { Agent } from '@mastra/core/agent';
import { z } from 'zod';

import {
  explainRiskAssessmentInputSchema,
  type RiskAssessmentProvider,
} from '../../contracts/providers/risk-assessment.js';
import type { IdempotencyRepository } from '../../contracts/repositories/idempotency-repository.js';
import { ProviderError, ProviderTimeoutError } from '../../contracts/shared/provider.js';
import type { Clock, CostRecorder, ProviderMetricsRecorder } from '../../contracts/technical/primitives.js';
import { riskNarrativeSchema } from '../../domain/risk.js';
import { fingerprintValue } from '../../services/stable-identifiers.js';

const prompt = Object.freeze({
  id: 'risk-narrative',
  version: '1.0.0',
  system:
    'Explain a deterministic KYC risk assessment using only the supplied redacted signals. Never change its score, level, route, or recommendation.',
  instructions:
    'Return one concise neutral summary. Do not infer identity, legal status, or facts absent from the signals.',
});
const promptChecksum = createHash('sha256').update(JSON.stringify(prompt)).digest('hex');
const wireSchema = z.object({ summary: z.string().min(1).max(1000) }).strict();
const storedNarrativeTelemetryBaseSchema = z
  .object({
    startedAt: z.iso.datetime({ offset: true }),
    completedAt: z.iso.datetime({ offset: true }),
  })
  .strict();
const storedNarrativeSchema = z.union([
  z
    .object({
      narrative: riskNarrativeSchema,
      telemetry: storedNarrativeTelemetryBaseSchema.extend({
        outcome: z.literal('success'),
        inputTokens: z.number().int().nonnegative(),
        outputTokens: z.number().int().nonnegative(),
      }),
    })
    .strict(),
  z
    .object({
      narrative: z.null(),
      telemetry: storedNarrativeTelemetryBaseSchema.extend({
        outcome: z.enum(['timeout', 'error']),
      }),
    })
    .strict(),
  z.object({ narrative: riskNarrativeSchema.nullable() }).strict(),
]);
const stableNarrativeInputSchema = explainRiskAssessmentInputSchema.omit({ generatedAt: true }).strip();
const invocationOperation = 'RISK_NARRATIVE_INVOCATION_V1';
const providerTimeoutMs = 25_000;
const invocationLeaseTtlMs = 30_000;

type GenerateResult = Readonly<{
  object: unknown;
  totalUsage: Readonly<{ inputTokens: number | undefined; outputTokens: number | undefined }>;
}>;
type StoredNarrative = z.infer<typeof storedNarrativeSchema>;
export type StructuredRiskNarrativeGenerator = (
  safeInput: z.infer<typeof explainRiskAssessmentInputSchema>,
  options: Readonly<{ abortSignal: AbortSignal }>,
) => Promise<GenerateResult>;

const createGenerator = (modelId: string): StructuredRiskNarrativeGenerator => {
  const agent = new Agent({
    id: 'structured-risk-narrative-agent',
    name: 'Structured Risk Narrative Agent',
    instructions: `${prompt.system}\n${prompt.instructions}`,
    model: modelId,
    maxRetries: 0,
  });
  return async (safeInput, options) => {
    const generated = await agent.generate(`Explain this redacted assessment: ${JSON.stringify(safeInput)}`, {
      abortSignal: options.abortSignal,
      structuredOutput: { schema: wireSchema },
      maxSteps: 1,
      modelSettings: { maxOutputTokens: 250 },
      tracingOptions: { hideInput: true, hideOutput: true },
    });
    if (generated.error !== undefined) throw generated.error;
    return { object: generated.object, totalUsage: generated.totalUsage };
  };
};

export class RuleBasedRiskAssessmentProvider implements RiskAssessmentProvider {
  explain(input: Parameters<RiskAssessmentProvider['explain']>[0]) {
    explainRiskAssessmentInputSchema.parse(input);
    return Promise.resolve(null);
  }
}

export class StructuredLlmRiskAssessmentProvider implements RiskAssessmentProvider {
  readonly #generate: StructuredRiskNarrativeGenerator;

  constructor(
    private readonly modelId: string,
    private readonly clock: Clock,
    generator?: StructuredRiskNarrativeGenerator,
    private readonly costRecorder?: CostRecorder,
    private readonly idempotency?: IdempotencyRepository,
    private readonly providerMetrics?: ProviderMetricsRecorder,
  ) {
    this.#generate = generator ?? createGenerator(modelId);
  }

  async explain(input: Parameters<RiskAssessmentProvider['explain']>[0]) {
    const parsed = explainRiskAssessmentInputSchema.parse(input);
    const inputChecksum = fingerprintValue(stableNarrativeInputSchema.parse(parsed));
    if (this.idempotency === undefined) {
      const stored = await this.#generateNarrative(parsed, inputChecksum);
      await this.#persistTelemetry(parsed, inputChecksum, stored);
      return stored.narrative;
    }
    const invocation = {
      tenantId: parsed.tenantId,
      operation: invocationOperation,
      key: inputChecksum,
      requestFingerprint: inputChecksum,
    };
    let leaseCreatedAt = this.clock.now().toISOString();
    try {
      const reservation = await this.idempotency.reserve({
        ...invocation,
        createdAt: leaseCreatedAt,
      });
      leaseCreatedAt = reservation.record.createdAt;
      if (!reservation.acquired) {
        if (reservation.record.status === 'COMPLETED')
          return await this.#replayStored(parsed, inputChecksum, reservation.record.resultJson);
        const completed = await this.#waitForCompletion(parsed, inputChecksum);
        if (completed !== undefined) return completed;
        const reacquired = await this.idempotency.reacquireExpired({
          ...invocation,
          createdAt: this.clock.now().toISOString(),
          expiredBefore: new Date(this.clock.now().getTime() - invocationLeaseTtlMs).toISOString(),
        });
        if (!reacquired.acquired) {
          return reacquired.record.status === 'COMPLETED'
            ? await this.#replayStored(parsed, inputChecksum, reacquired.record.resultJson)
            : null;
        }
        leaseCreatedAt = reacquired.record.createdAt;
      }
      const stored = await this.#generateNarrative(parsed, inputChecksum);
      await this.idempotency.complete({
        ...invocation,
        createdAt: leaseCreatedAt,
        completedAt: this.clock.now().toISOString(),
        resultJson: JSON.stringify(stored),
      });
      await this.#persistTelemetry(parsed, inputChecksum, stored);
      return stored.narrative;
    } catch {
      await this.idempotency
        .complete({
          ...invocation,
          createdAt: leaseCreatedAt,
          completedAt: this.clock.now().toISOString(),
          resultJson: JSON.stringify({ narrative: null }),
        })
        .catch(() => undefined);
      return null;
    }
  }

  async #generateNarrative(
    parsed: z.infer<typeof explainRiskAssessmentInputSchema>,
    inputChecksum: string,
  ): Promise<StoredNarrative> {
    const startedAt = this.clock.now().toISOString();
    let generated: GenerateResult;
    const abortController = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutError = new ProviderTimeoutError({
        providerId: 'openai-risk-narrative',
        operation: 'RISK_EVALUATION',
        safeMessage: 'The risk narrative provider timed out',
      });
      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          abortController.abort();
          reject(timeoutError);
        }, providerTimeoutMs);
      });
      generated = await Promise.race([this.#generate(parsed, { abortSignal: abortController.signal }), timeoutPromise]);
      const wire = wireSchema.safeParse(generated.object);
      if (!wire.success) {
        return {
          narrative: null,
          telemetry: {
            outcome: 'error',
            startedAt,
            completedAt: this.clock.now().toISOString(),
          },
        };
      }
      const outputChecksum = fingerprintValue(wire.data);
      const narrative = riskNarrativeSchema.parse({
        summary: wire.data.summary,
        providerId: 'openai-risk-narrative',
        providerVersion: '1.0.0',
        modelId: this.modelId,
        promptId: prompt.id,
        promptVersion: prompt.version,
        promptChecksum,
        schemaVersion: '1.0.0',
        inputChecksum,
        outputChecksum,
        generatedAt: parsed.generatedAt,
      });
      const completedAt = this.clock.now().toISOString();
      return {
        narrative,
        telemetry: {
          outcome: 'success',
          startedAt,
          completedAt,
          inputTokens: Math.max(0, generated.totalUsage.inputTokens ?? 0),
          outputTokens: Math.max(0, generated.totalUsage.outputTokens ?? 0),
        },
      };
    } catch (error) {
      return {
        narrative: null,
        telemetry: {
          outcome: error instanceof ProviderError && error.details.code === 'PROVIDER_TIMEOUT' ? 'timeout' : 'error',
          startedAt,
          completedAt: this.clock.now().toISOString(),
        },
      };
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }

  #parseStored(resultJson: string | null) {
    if (resultJson === null) return storedNarrativeSchema.parse({ narrative: null });
    return storedNarrativeSchema.parse(JSON.parse(resultJson));
  }

  async #replayStored(
    parsed: z.infer<typeof explainRiskAssessmentInputSchema>,
    inputChecksum: string,
    resultJson: string | null,
  ) {
    const stored = this.#parseStored(resultJson);
    await this.#persistTelemetry(parsed, inputChecksum, stored);
    return stored.narrative;
  }

  async #persistTelemetry(
    parsed: z.infer<typeof explainRiskAssessmentInputSchema>,
    inputChecksum: string,
    stored: StoredNarrative,
  ) {
    const telemetry = 'telemetry' in stored ? stored.telemetry : undefined;
    if (telemetry === undefined) return;
    if (telemetry.outcome === 'success' && stored.narrative !== null && this.costRecorder !== undefined) {
      const costPersisted = await this.costRecorder
        .record({
          tenantId: parsed.tenantId,
          caseId: parsed.caseId,
          usageEventId: `risk-narrative:${inputChecksum}:${telemetry.startedAt}:success`,
          providerId: stored.narrative.providerId,
          operation: 'RISK_NARRATIVE',
          inputUnits: telemetry.inputTokens,
          outputUnits: telemetry.outputTokens,
          estimatedCostUsd: 0,
          priceVersion: 'unpriced-risk-narrative-v1',
          latencyMs: Math.max(0, new Date(telemetry.completedAt).getTime() - new Date(telemetry.startedAt).getTime()),
          recordedAt: telemetry.completedAt,
        })
        .then(
          () => true,
          () => false,
        );
      if (!costPersisted) return;
    }
    if (this.providerMetrics !== undefined) {
      await this.providerMetrics
        .recordProvider({
          tenantId: parsed.tenantId,
          eventId: `provider:risk-narrative:${inputChecksum}:${telemetry.startedAt}:${telemetry.outcome}`,
          caseId: parsed.caseId,
          providerId: 'openai-risk-narrative',
          operation: 'RISK_NARRATIVE',
          outcome: telemetry.outcome,
          startedAt: telemetry.startedAt,
          completedAt: telemetry.completedAt,
          attemptCount: 1,
          retryCount: 0,
        })
        .catch(() => undefined);
    }
  }

  async #waitForCompletion(parsed: z.infer<typeof explainRiskAssessmentInputSchema>, key: string) {
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 20));
      const record = await this.idempotency?.get(parsed.tenantId, invocationOperation, key);
      if (record?.status === 'COMPLETED') return this.#replayStored(parsed, key, record.resultJson);
    }
    return undefined;
  }
}
