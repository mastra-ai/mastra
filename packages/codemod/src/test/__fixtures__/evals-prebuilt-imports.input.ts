// @ts-nocheck

// LLM-based scorers - should transform
import { createHallucinationScorer } from '@mastra/evals/scorers/llm';
import { createFaithfulnessScorer } from '@mastra/evals/scorers/llm';

// Code-based scorers - should transform
import { createContentSimilarityScorer } from '@mastra/evals/scorers/code';
import { createCompletenessScorer } from '@mastra/evals/scorers/code';

// Mixed imports - should transform
import { createAccuracyScorer, createRelevanceScorer } from '@mastra/evals/scorers/llm';

// Should NOT transform - different package
import { someFunction } from '@other/package/scorers/llm';
import { anotherFunction } from '@other/package/scorers/code';

// Should NOT transform - already using prebuilt
import { createCustomScorer } from '@mastra/evals/scorers/prebuilt';

const hallucination = createHallucinationScorer();
const faithfulness = createFaithfulnessScorer();
const similarity = createContentSimilarityScorer();
const completeness = createCompletenessScorer();