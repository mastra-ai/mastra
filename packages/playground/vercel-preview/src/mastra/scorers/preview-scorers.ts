import { createScorer } from '@mastra/core/evals';

/**
 * Deterministic scorers for the preview.
 *
 * They use a fixed `generateScore` value instead of an LLM judge, so both the
 * seed routine and any live agent runs stay free, fast, and deterministic — no
 * extra model calls, no provider key required for scoring to work.
 */
export const answerRelevanceScorer = createScorer({
  id: 'answer-relevance',
  name: 'Answer Relevance',
  description: 'Preview scorer that rates how directly a reply answers the prompt.',
  type: 'agent',
}).generateScore(() => 0.9);

export const toneQualityScorer = createScorer({
  id: 'tone-quality',
  name: 'Tone Quality',
  description: 'Preview scorer that rates reply tone and clarity.',
  type: 'agent',
}).generateScore(() => 0.82);

/** Registered on both the Mastra instance and the agent so Studio lists them. */
export const previewScorers = {
  'answer-relevance': answerRelevanceScorer,
  'tone-quality': toneQualityScorer,
};
