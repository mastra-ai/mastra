import { createScorer, type MastraScorers } from "@mastra/core/evals";
import {
  canonicalScorerRecord,
  isPlainJsonRecord,
  scoreAxis,
} from "./deterministic-semantics.js";
import { topLevelModelOutput } from "../../../src/mastra/evals";
type EvalOutput = Record<string, unknown>;
const plainRecord = (value: unknown): EvalOutput =>
  isPlainJsonRecord(value) ? (value as EvalOutput) : {};
export function scoreDraftResolutionFields(output: unknown) {
  const parsed = plainRecord(topLevelModelOutput(output));
  const citedSources = Array.isArray(parsed.citedSources)
    ? parsed.citedSources.filter(
        (source): source is string => typeof source === "string",
      )
    : [];
  return {
    hasDraftResponse:
      typeof parsed.draftResponse === "string" &&
      parsed.draftResponse.trim().length > 0,
    hasSources: citedSources.length > 0,
    recommendsRefund: parsed.recommendRefund === true,
    requiresEscalation: parsed.requiresEscalation === true,
    citedSources,
  };
}
function deterministicScorer(
  id: string,
  name: string,
  score?: (output: unknown, truth: unknown) => number,
) {
  return createScorer({
    id,
    name,
    description: `Deterministic ${name} scorer for versioned support-eval evidence.`,
    type: "agent",
  })
    .preprocess(({ run }) => ({
      output: canonicalScorerRecord(topLevelModelOutput(run.output)),
      truth: canonicalScorerRecord(run.groundTruth),
    }))
    .generateScore(({ results }) =>
      score
        ? score(
            results.preprocessStepResult?.output,
            results.preprocessStepResult?.truth,
          )
        : scoreAxis(
            id,
            results.preprocessStepResult?.output as Parameters<
              typeof scoreAxis
            >[1],
            results.preprocessStepResult?.truth as Parameters<
              typeof scoreAxis
            >[2],
          ),
    )
    .generateReason(
      ({ score }) =>
        `${id}=${Number.isFinite(score) ? score.toFixed(2) : "0.00"} from deterministic canonical evidence`,
    );
}
export const routingAccuracyScorer = deterministicScorer(
  "routing-accuracy",
  "Routing Accuracy",
);
export const groundednessScorer = deterministicScorer(
  "groundedness",
  "Groundedness",
);
export const policyComplianceScorer = deterministicScorer(
  "policy-compliance",
  "Policy Compliance",
);
export const toolCallCorrectnessScorer = deterministicScorer(
  "tool-call-correctness",
  "Tool Call Correctness",
);
export const resolutionQualityScorer = deterministicScorer(
  "resolution-quality",
  "Resolution Quality",
);
export const multiTurnConsistencyScorer = deterministicScorer(
  "multi-turn-consistency",
  "Multi-turn Consistency",
);
export const responseStructureSanityScorer = deterministicScorer(
  "response-structure-sanity",
  "Response Structure Sanity",
  (output) => (scoreDraftResolutionFields(output).hasDraftResponse ? 1 : 0),
);
export const conversationCoverageScorer = deterministicScorer(
  "conversation-coverage",
  "Conversation Coverage",
  (output) =>
    (Array.isArray(plainRecord(canonicalScorerRecord(output)).answers)
      ? plainRecord(canonicalScorerRecord(output)).answers
      : []
    ).filter((answer) => typeof answer === "string").length > 1
      ? 1
      : 0,
);
export const responseAgentScorers: MastraScorers = {
  groundedness: { scorer: groundednessScorer },
  policyCompliance: { scorer: policyComplianceScorer },
  toolCallCorrectness: { scorer: toolCallCorrectnessScorer },
  resolutionQuality: { scorer: resolutionQualityScorer },
  multiTurnConsistency: { scorer: multiTurnConsistencyScorer },
  responseStructureSanity: { scorer: responseStructureSanityScorer },
  conversationCoverage: { scorer: conversationCoverageScorer },
};
export const triageAgentScorers: MastraScorers = {
  routingAccuracy: { scorer: routingAccuracyScorer },
  multiTurnConsistency: { scorer: multiTurnConsistencyScorer },
  conversationCoverage: { scorer: conversationCoverageScorer },
};
export const supportEvalScorerRegistry = {
  routingAccuracy: routingAccuracyScorer,
  groundedness: groundednessScorer,
  policyCompliance: policyComplianceScorer,
  toolCallCorrectness: toolCallCorrectnessScorer,
  resolutionQuality: resolutionQualityScorer,
  multiTurnConsistency: multiTurnConsistencyScorer,
  responseStructureSanity: responseStructureSanityScorer,
  conversationCoverage: conversationCoverageScorer,
};
