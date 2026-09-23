/**
 * Mastra ships 23 scorers. You rarely need to write your own.
 *
 * They divide along the line that should shape your whole eval strategy:
 *
 *   CODE scorers   deterministic, free, milliseconds, no API key.
 *                  Safe to gate a merge on.
 *   LLM scorers    a model grades the output. Non-deterministic, costs money,
 *                  takes seconds. Use for quality trends and sampled traffic.
 *
 * This module curates a few of each. The full set is exported from
 * `@mastra/evals/scorers/prebuilt`.
 */
import {
  createCompletenessScorer,
  createContentSimilarityScorer,
  createKeywordCoverageScorer,
  createToneScorer,
} from '@mastra/evals/scorers/prebuilt';
import {
  createAnswerRelevancyScorer,
  createFaithfulnessScorer,
  createToxicityScorer,
} from '@mastra/evals/scorers/prebuilt';
import { JUDGE_MODEL } from '../models.ts';

// ---------------------------------------------------------------------------
// Code scorers — no API key, deterministic
// ---------------------------------------------------------------------------

/** Fraction of the expected keywords that appear in the output. */
export const keywordCoverage = createKeywordCoverageScorer();

/** How much of the input's content is reflected in the output. */
export const completeness = createCompletenessScorer();

/** Sentiment/tone stability of the output. */
export const tone = createToneScorer();

/** Character-level similarity between output and a reference string. */
export const contentSimilarity = createContentSimilarityScorer();

export const CODE_SCORERS = [keywordCoverage, completeness, tone];

// ---------------------------------------------------------------------------
// LLM judges — require OPENAI_API_KEY
// ---------------------------------------------------------------------------

/** Does the answer actually address the question? */
export const answerRelevancy = createAnswerRelevancyScorer({ model: JUDGE_MODEL });

/** Is the answer free of abusive or harmful language? */
export const toxicity = createToxicityScorer({ model: JUDGE_MODEL });

/**
 * Faithfulness takes its reference context at *construction* time, not per
 * data item — so building one per context is the supported shape when each
 * row has its own retrieved passages.
 */
export function faithfulnessFor(context: string[]) {
  return createFaithfulnessScorer({ model: JUDGE_MODEL, options: { context } });
}

export const LLM_SCORERS = [answerRelevancy, toxicity];
