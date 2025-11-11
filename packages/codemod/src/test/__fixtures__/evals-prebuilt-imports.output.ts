// @ts-nocheck

// LLM-based scorers - should transform
import { createHallucinationScorer } from '@mastra/evals/scorers/prebuilt';
import { createFaithfulnessScorer } from '@mastra/evals/scorers/prebuilt';

// Code-based scorers - should transform
import { createContentSimilarityScorer } from '@mastra/evals/scorers/prebuilt';
import { createCompletenessScorer } from '@mastra/evals/scorers/prebuilt';

// Mixed imports - should transform
import { createAccuracyScorer, createRelevanceScorer } from '@mastra/evals/scorers/prebuilt';

// Should NOT transform - different package
import { someFunction } from '@other/package/scorers/llm';
import { anotherFunction } from '@other/package/scorers/code';

// Should NOT transform - already using prebuilt
import { createCustomScorer } from '@mastra/evals/scorers/prebuilt';

const hallucination = createHallucinationScorer();
const faithfulness = createFaithfulnessScorer();
const similarity = createContentSimilarityScorer();
const completeness = createCompletenessScorer();