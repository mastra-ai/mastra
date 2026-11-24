import type { ClassificationRoute } from './classification';
import { POLICY_DEFAULTS } from '../config';

export type EvaluationSplit = 'calibration' | 'held-out';

export const LIVE_EVALUATION_DATASET_VERSION = 'live-held-out-v1';

export type EvaluationObservation = {
  id: string;
  split: EvaluationSplit;
  expectedRoute?: ClassificationRoute;
  actualRoute?: ClassificationRoute;
  evidenceAttributed?: boolean;
  summarySupported?: boolean;
  choiceConfidence?: number;
};

export type EvaluationProvenance = {
  model?: { requested?: string; reported?: string; verified?: string };
  usage?: { inputTokens?: number; outputTokens?: number };
  budget?: {
    provider: 'jev' | 'openai';
    ceilingUsd: number;
    reservedUsd?: number;
    knownUsd?: number;
    unresolvedUsd?: number;
  };
};

type Ratio = { numerator: number; denominator: number; value?: number };

function ratio(numerator: number, denominator: number): Ratio {
  return { numerator, denominator, ...(denominator === 0 ? {} : { value: numerator / denominator }) };
}

/**
 * Produces denominator-preserving evaluation output for synthetic and live runs.
 * A missing observation remains visible rather than being counted as a failed or free result.
 */
export function reportEvaluation(input: {
  datasetVersion: string;
  questionSetVersion: string;
  ruleVersion: string;
  observations: EvaluationObservation[];
  provenance?: EvaluationProvenance;
}) {
  const classified = input.observations.filter(
    (
      observation,
    ): observation is EvaluationObservation & {
      expectedRoute: ClassificationRoute;
      actualRoute: ClassificationRoute;
    } => observation.expectedRoute !== undefined && observation.actualRoute !== undefined,
  );
  const expectedAlerts = classified.filter(observation => observation.expectedRoute === 'alert');
  const actualAlerts = classified.filter(observation => observation.actualRoute === 'alert');
  const expectedReviews = classified.filter(observation => observation.expectedRoute === 'review');
  const evidenceChecks = input.observations.filter(observation => observation.evidenceAttributed !== undefined);
  const summaryChecks = input.observations.filter(observation => observation.summarySupported !== undefined);
  const confidenceChecks = input.observations.filter(observation => observation.choiceConfidence !== undefined);
  const routes: ClassificationRoute[] = ['alert', 'review', 'record', 'ignore'];

  return {
    datasetVersion: input.datasetVersion,
    questionSetVersion: input.questionSetVersion,
    ruleVersion: input.ruleVersion,
    sampleSize: {
      total: input.observations.length,
      calibration: input.observations.filter(observation => observation.split === 'calibration').length,
      heldOut: input.observations.filter(observation => observation.split === 'held-out').length,
      classified: classified.length,
    },
    metrics: {
      routeConfusionMatrix: Object.fromEntries(
        routes.map(expected => [
          expected,
          Object.fromEntries(
            routes.map(actual => [
              actual,
              classified.filter(item => item.expectedRoute === expected && item.actualRoute === actual).length,
            ]),
          ),
        ]),
      ),
      routeAccuracy: ratio(
        classified.filter(observation => observation.expectedRoute === observation.actualRoute).length,
        classified.length,
      ),
      alertPrecision: ratio(
        actualAlerts.filter(observation => observation.expectedRoute === 'alert').length,
        actualAlerts.length,
      ),
      alertRecall: ratio(
        expectedAlerts.filter(observation => observation.actualRoute === 'alert').length,
        expectedAlerts.length,
      ),
      reviewRecall: ratio(
        expectedReviews.filter(observation => observation.actualRoute === 'review').length,
        expectedReviews.length,
      ),
      lowConfidenceReview: ratio(
        confidenceChecks.filter(
          observation =>
            observation.choiceConfidence! < POLICY_DEFAULTS.minimumChoiceConfidence &&
            observation.actualRoute === 'review',
        ).length,
        confidenceChecks.filter(observation => observation.choiceConfidence! < POLICY_DEFAULTS.minimumChoiceConfidence)
          .length,
      ),
      evidenceAttribution: ratio(
        evidenceChecks.filter(observation => observation.evidenceAttributed).length,
        evidenceChecks.length,
      ),
      supportedSummaries: ratio(
        summaryChecks.filter(observation => observation.summarySupported).length,
        summaryChecks.length,
      ),
    },
    provenance: {
      model: {
        requested: input.provenance?.model?.requested ?? null,
        reported: input.provenance?.model?.reported ?? null,
        verified: input.provenance?.model?.verified ?? null,
      },
      usage: {
        inputTokens: input.provenance?.usage?.inputTokens ?? null,
        outputTokens: input.provenance?.usage?.outputTokens ?? null,
      },
      budget: input.provenance?.budget
        ? {
            provider: input.provenance.budget.provider,
            ceilingUsd: input.provenance.budget.ceilingUsd,
            reservedUsd: input.provenance.budget.reservedUsd ?? null,
            knownUsd: input.provenance.budget.knownUsd ?? null,
            unresolvedUsd: input.provenance.budget.unresolvedUsd ?? null,
          }
        : null,
    },
  };
}
