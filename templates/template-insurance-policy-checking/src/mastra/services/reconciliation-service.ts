import { z } from 'zod';
import { insuranceConfigurationSchema } from '../config/insurance.js';
import { processingConfigurationSchema } from '../config/processing.js';
import {
  compareRequestSchema,
  extractionSchema,
  semanticSchema,
  type CompareRequest,
} from '../domain/reconciliation-contracts.js';
import { contextSchema, type OperationContext } from '../domain/contracts.js';
import { IntakeError } from '../domain/errors.js';
import { equalValues, normalizeText, reconcile, verifyEvidence, verifyExtraction } from '../domain/reconciliation.js';
import type { StructuredProcessingModel } from '../domain/reconciliation-contracts.js';
import type { AnalysisInput, ReconciliationRepository } from '../storage/reconciliation.js';

export function createReconciliationService(
  repository: ReconciliationRepository,
  model: StructuredProcessingModel,
  configuration: z.infer<typeof processingConfigurationSchema>,
  profiles: z.infer<typeof insuranceConfigurationSchema>,
) {
  const settings = processingConfigurationSchema.parse(configuration);
  const insurance = insuranceConfigurationSchema.parse(profiles);
  return {
    async process(context: OperationContext, request: CompareRequest, runId: string) {
      contextSchema.parse(context);
      compareRequestSchema.parse(request);
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
          'Processing requires explicitly approved request, token, retry and cost budgets.',
          'Configure the approved Q-004 processing values in src/mastra/config/processing.ts before paid execution.',
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
        promptVersion: 'insurance-1',
        budget: structuredClone(settings.budget),
      };
      const attempt = await repository.claim(context, request, input, runId);
      try {
        const results = await Promise.allSettled(
          attempt.input.sources.map(async source => {
            const extraction = await model.generate(context, attempt, `extract:${source.sourceId}`, extractionSchema, {
              source,
              role:
                attempt.input.clarification.roles.find(role => role.sourceId === source.sourceId)?.role ?? source.role,
              identity: attempt.input.identity,
            });
            verifyExtraction(extraction, source);
            await repository.saveExtraction(context, attempt.id, extraction);
            return extraction;
          }),
        );
        const failure = results.find(result => result.status === 'rejected');
        if (failure?.status === 'rejected') throw failure.reason;
        const extractions = results.map(result => {
          if (result.status === 'rejected') throw result.reason;
          return result.value;
        });
        const reference = extractions.find(value => value.sourceId === attempt.input.clarification.referenceId)!;
        const target = extractions.find(value => value.sourceId === attempt.input.clarification.targetId)!;
        const clauses = reference.terms
          .filter(term => term.value.type === 'clause')
          .flatMap(left => {
            const right = target.terms.find(
              term =>
                term.category === left.category &&
                term.key === left.key &&
                term.scope === left.scope &&
                term.value.type === 'clause',
            );
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
        const assessmentKeys = new Set<string>();
        for (const assessment of semantic.assessments) {
          const pair = clauses.find(
            pair =>
              pair.reference.key === assessment.key &&
              pair.reference.category === assessment.category &&
              pair.reference.scope === assessment.scope,
          );
          const key = `${assessment.category}\0${assessment.key}\0${assessment.scope}`;
          if (
            !pair ||
            assessmentKeys.has(key) ||
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
          assessmentKeys.add(key);
          for (const evidence of assessment.evidence) verifyEvidence(evidence, attempt.input.sources);
        }
        const analysis = reconcile(attempt.input, extractions, semantic, attempt.id);
        analysis.inputHash = attempt.inputHash;
        await repository.finish(context, attempt.id, analysis);
        return {
          analysisId: analysis.id,
          attemptId: attempt.id,
          workflowRunId: runId,
          conclusion: analysis.conclusion,
          comparisons: analysis.comparisons.map(({ id, label, classification, observation }) => ({
            id,
            label,
            classification,
            observation,
          })),
          limitations: analysis.limitations,
        };
      } catch (error) {
        await repository.finish(context, attempt.id, null, error);
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
