import { z } from 'zod';
import { insuranceConfigurationSchema } from '../config/insurance-config.js';
import { processingConfigurationSchema } from '../config/processing-config.js';
import { canonicalJson, contextSchema, type OperationContext } from '../domain/case-contracts.js';
import { EvidenceValidationError, IntakeError, safeFailure } from '../domain/operation-errors.js';
import type { Analysis, AnalysisInput, StructuredProcessingModel } from '../domain/reconciliation-contracts.js';
import {
  compareRequestSchema,
  extractionSchema,
  semanticSchema,
  type CompareRequest,
} from '../domain/reconciliation-contracts.js';
import { equalValues, reconcile, verifyEvidence, verifyExtraction } from '../domain/reconciliation-engine.js';
import { normalizeText, sameTerm } from '../domain/term-utils.js';
import { operation } from '../runtime/operation-logger.js';
import type { ReconciliationRepository } from '../storage/reconciliation-repository.js';

export function createReconciliationService(
  repository: ReconciliationRepository,
  model: StructuredProcessingModel,
  configuration: z.infer<typeof processingConfigurationSchema>,
  profiles: z.infer<typeof insuranceConfigurationSchema>,
) {
  const settings = processingConfigurationSchema.parse(configuration);
  const insurance = insuranceConfigurationSchema.parse(profiles);
  const savedResult = (analysis: Analysis, runId: string) => ({
    analysisId: analysis.id,
    attemptId: analysis.attemptId,
    workflowRunId: runId,
    conclusion: analysis.conclusion,
    comparisons: analysis.comparisons.map(({ id, label, classification, observation }) => ({
      id,
      label,
      classification,
      observation,
    })),
    limitations: analysis.limitations,
  });
  async function completed(context: OperationContext, runId?: string) {
    const record = await repository.cases.requireCase(context);
    const status = await repository.status(context);
    const analysis = status.analyses.find(a => a.id === record.latestAnalysisId);
    const attempt = status.attempts.find(
      a => a.id === analysis?.attemptId && a.state === 'COMPLETED' && (!runId || a.runId === runId),
    );
    if (!analysis || !attempt) return null;
    if (
      canonicalJson(record.clarification) !== canonicalJson(analysis.input.clarification) ||
      canonicalJson(record.identity) !== canonicalJson(analysis.input.identity)
    )
      throw new IntakeError(
        'ANALYSIS_INPUT_CHANGED',
        'The saved comparison belongs to earlier case clarification.',
        'Run a newly authorized comparison of the current case; historical analysis remains readable.',
        409,
      );
    await repository.verifySources(context, analysis.input.sources);
    return {
      result: savedResult(analysis, attempt.runId),
      request: {
        caseId: record.id,
        expectedRevision: analysis.input.sourceRevision,
        profileId: analysis.input.profile.id,
        asOf: analysis.input.asOf,
        retryAttemptId: null,
      },
    };
  }
  return {
    completed,
    async process(context: OperationContext, request: CompareRequest, runId: string, awaitPublication = false) {
      contextSchema.parse(context);
      compareRequestSchema.parse(request);
      if (awaitPublication) {
        const saved = await completed(context, runId);
        if (saved) return saved.result;
      }
      await repository.recover(context);
      const record = await repository.cases.requireCase(context, request.caseId);
      const profile = insurance.profiles.find(profile => profile.id === request.profileId);
      if (!profile)
        throw new IntakeError(
          'UNKNOWN_PROFILE',
          'The selected insurance profile is not registered.',
          'Choose a configured profile ID.',
        );
      if (!record.clarification || record.sourceIds.length < 2)
        throw new IntakeError(
          'COMPARISON_CLARIFICATION',
          'Comparison needs explicit reference, target, intent and document roles.',
          'Use /status and /clarify before comparison.',
        );
      if (!settings.budget)
        throw new IntakeError(
          'MODEL_BUDGET_REQUIRED',
          'Processing is disabled because this application configuration has no budget.',
          'Use the built-in processing budget or configure POLICY_PROCESSING_BUDGET with a valid budget JSON file path, then restart.',
        );
      const input: AnalysisInput = {
        schemaVersion: 'reconciliation-1',
        caseId: record.id,
        sourceRevision: record.revision,
        clarification: structuredClone(record.clarification),
        identity: record.identity,
        sources: await repository.cases.sources(context),
        profile: structuredClone(profile),
        asOf: request.asOf,
        model: settings.model,
        promptVersion: 'insurance-4',
        budget: structuredClone(settings.budget),
      };
      const attempt = await repository.claim(context, request, input, runId);
      const started = Date.now();
      operation({
        stage: 'processing',
        outcome: 'started',
        caseId: record.id,
        runId,
        attemptId: attempt.id,
        costMicros: null,
      });
      try {
        const referenceSource = attempt.input.sources.find(
          source => source.sourceId === attempt.input.clarification.referenceId,
        )!;
        const sources = attempt.input.sources.map(source => ({
          sourceId: source.sourceId,
          displayName: source.displayName,
          role: attempt.input.clarification.roles.find(role => role.sourceId === source.sourceId)?.role ?? source.role,
          kind: source.kind,
        }));
        const extract = async (
          source: (typeof attempt.input.sources)[number],
          referenceTerms: { category: string; key: string; label: string; scope: string; valueType: string }[],
        ) => {
          const extraction = await model.generate(context, attempt, `extract:${source.sourceId}`, extractionSchema, {
            source,
            role: sources.find(item => item.sourceId === source.sourceId)!.role,
            identity: attempt.input.identity,
            clarification: attempt.input.clarification,
            sources,
            profile: attempt.input.profile,
            referenceTerms,
          });
          try {
            verifyExtraction(extraction, source);
          } catch (error) {
            if (error instanceof EvidenceValidationError)
              operation({
                stage: 'processing',
                outcome: 'failed',
                caseId: record.id,
                runId,
                attemptId: attempt.id,
                sourceId: source.sourceId,
                failurePhase: 'evidence_validation',
                grounding: error.grounding,
                errorCode: error.code,
                costMicros: null,
              });
            throw error;
          }
          await repository.saveExtraction(context, attempt.id, extraction);
          return extraction;
        };
        // Validate the selected reference before using its vocabulary for other documents.
        // The schema bounds this catalog to 300 terms and omits values and quotations:
        // matching a concept must never copy the reference's result into another source.
        const reference = await extract(referenceSource, []);
        const referenceTerms = reference.terms.map(({ category, key, label, scope, value }) => ({
          category,
          key,
          label,
          scope,
          valueType: value.type,
        }));
        const results = await Promise.allSettled(
          attempt.input.sources
            .filter(source => source.sourceId !== referenceSource.sourceId)
            .map(source => extract(source, referenceTerms)),
        );
        const failure = results.find(result => result.status === 'rejected');
        if (failure?.status === 'rejected') throw failure.reason;
        const extractions = [
          reference,
          ...results.map(result => {
            if (result.status === 'rejected') throw result.reason;
            return result.value;
          }),
        ];
        const target = extractions.find(value => value.sourceId === attempt.input.clarification.targetId)!;
        const clauses = reference.terms
          .filter(term => term.value.type === 'clause')
          .flatMap(left => {
            const right = target.terms.find(term => sameTerm(term, left) && term.value.type === 'clause');
            if (
              !right ||
              left.value.type !== 'clause' ||
              right.value.type !== 'clause' ||
              equalValues(left.value, right.value)
            )
              return [];
            const identifiersAlign =
              left.value.clauseId !== null && right.value.clauseId !== null
                ? left.value.clauseId === right.value.clauseId
                : normalizeText(left.value.heading) === normalizeText(right.value.heading);
            const words = (value: string) => new Set(normalizeText(value).match(/[a-z0-9]{3,}/g) ?? []);
            const leftWords = words(left.value.wording),
              rightWords = words(right.value.wording);
            const overlap = [...leftWords].filter(word => rightWords.has(word)).length;
            return identifiersAlign && overlap >= Math.min(leftWords.size, rightWords.size) / 2
              ? [{ reference: left, target: right }]
              : [];
          });
        const semantic = clauses.length
          ? await model.generate(context, attempt, 'semantic', semanticSchema, { clauses })
          : { assessments: [] };
        for (const [assessmentIndex, assessment] of semantic.assessments.entries()) {
          const pair = clauses.find(pair => sameTerm(pair.reference, assessment));
          if (
            !pair ||
            ![pair.reference, pair.target].every(term =>
              assessment.evidence.some(item =>
                term.evidence.some(saved => JSON.stringify(saved) === JSON.stringify(item)),
              ),
            )
          )
            throw new IntakeError(
              'INVALID_SEMANTIC_EVIDENCE',
              'A clause assessment is duplicated, unaligned or lacks both original evidence references.',
              'Review clause evidence before retrying.',
            );
          for (const [evidenceIndex, evidence] of assessment.evidence.entries())
            verifyEvidence(evidence, attempt.input.sources, [
              'assessments',
              assessmentIndex,
              'evidence',
              evidenceIndex,
            ]);
        }
        const analysis = reconcile(attempt.input, extractions, semantic, attempt.id);
        analysis.inputHash = attempt.inputHash;
        await repository.finish(context, attempt.id, analysis, undefined, awaitPublication);
        operation({
          stage: 'processing',
          outcome: 'completed',
          caseId: record.id,
          runId,
          attemptId: attempt.id,
          durationMs: Date.now() - started,
          checked: analysis.comparisons.length,
          classifications: {
            match: analysis.comparisons.filter(f => f.classification === 'MATCH').length,
            discrepancy: analysis.comparisons.filter(f => f.classification === 'DISCREPANCY').length,
            authorized: analysis.comparisons.filter(f => f.classification === 'AUTHORIZED_CHANGE').length,
            unresolved: analysis.comparisons.filter(f =>
              ['MISSING_EVIDENCE', 'REQUIRES_REVIEW'].includes(f.classification),
            ).length,
          },
          costMicros: null,
        });
        return savedResult(analysis, runId);
      } catch (error) {
        await repository.finish(context, attempt.id, null, error);
        operation({
          stage: 'processing',
          outcome: 'failed',
          caseId: record.id,
          runId,
          attemptId: attempt.id,
          durationMs: Date.now() - started,
          errorCode: safeFailure(error).code,
          ...(error instanceof EvidenceValidationError ? { sourceId: error.sourceId, grounding: error.grounding } : {}),
          recovery: 'read_status',
          costMicros: null,
        });
        throw error;
      }
    },
    async status(context: OperationContext) {
      await repository.recover(context);
      const status = await repository.status(context);
      return {
        progress: await repository.progress(context),
        attempts: status.attempts.map(({ id, runId, state, failure, analysisId, inputHash }) => ({
          id,
          runId,
          state,
          failure,
          analysisId,
          inputHash,
        })),
        analyses: status.analyses.map(analysis => ({
          id: analysis.id,
          attemptId: analysis.attemptId,
          inputHash: analysis.inputHash,
          profile: { id: analysis.input.profile.id, version: analysis.input.profile.version },
          conclusion: analysis.conclusion,
          comparisons: analysis.comparisons.map(
            ({
              id,
              category,
              key,
              label,
              scope,
              classification,
              observation,
              interpretation,
              action,
              uncertainty,
              severity,
              searched,
            }) => ({
              id,
              category,
              key,
              label,
              scope,
              classification,
              observation,
              interpretation,
              action,
              uncertainty,
              severity,
              searched,
            }),
          ),
          rules: analysis.rules,
          limitations: analysis.limitations,
        })),
      };
    },
  };
}
export type ReconciliationService = ReturnType<typeof createReconciliationService>;
