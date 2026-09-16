import { createScorer, type MastraScorers } from "@mastra/core/evals";
import { getAssistantMessageFromRunOutput } from "@mastra/evals/scorers/utils";
import {
  draftResolutionSchema,
  triageResultSchema,
} from "../domain/support-case";

type EvalOutput = Record<string, unknown>;

export function plainEvalRecord(value: unknown): EvalOutput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null
    ? (value as EvalOutput)
    : {};
}

export function topLevelModelOutput(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function liveOutputContractScorer(
  id: string,
  name: string,
  accepts: (output: EvalOutput) => boolean,
) {
  return createScorer({
    id,
    name,
    description: `Checks that a native agent run produced the ${name.toLowerCase()} contract; it is not a quality score.`,
    type: "agent",
  })
    .preprocess(({ run }) => {
      const text = getAssistantMessageFromRunOutput(run.output);
      return text ? plainEvalRecord(topLevelModelOutput(text)) : {};
    })
    .generateScore(({ results }) =>
      accepts(results.preprocessStepResult ?? {}) ? 1 : 0,
    )
    .generateReason(({ score }) =>
      score === 1
        ? "native output contract present"
        : "native output contract missing; no dataset-quality judgment was made",
    );
}

export const liveTriageOutputScorer = liveOutputContractScorer(
  "live-triage-output-contract",
  "Triage Output Contract",
  (output) => triageResultSchema.safeParse(output).success,
);
export const liveResponseOutputScorer = liveOutputContractScorer(
  "live-response-output-contract",
  "Response Output Contract",
  (output) => draftResolutionSchema.safeParse(output).success,
);
export const liveTriageAgentScorers: MastraScorers = {
  outputContract: { scorer: liveTriageOutputScorer },
};
export const liveResponseAgentScorers: MastraScorers = {
  outputContract: { scorer: liveResponseOutputScorer },
};
export const liveSupportScorerRegistry = {
  liveTriageOutputScorer,
  liveResponseOutputScorer,
};
