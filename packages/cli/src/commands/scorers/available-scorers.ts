import type { ScorerTemplate } from './types';

// Define all available scorers from the @mastra/evals package
export const AVAILABLE_SCORERS: ScorerTemplate[] = [
  {
    id: 'answer-relevancy',
    name: 'Answer Relevancy',
    description: 'Evaluates how relevant the answer is to the question',
    category: 'output-quality',
    type: 'llm',
    filename: 'answer-relevancy-scorer.ts',
    content: `import { createAnswerRelevancyScorer } from '@mastra/evals';
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const answerRelevancyScorer = createAnswerRelevancyScorer({
  model: openai('gpt-4o-mini'),
});`
  },
  {
    id: 'bias',
    name: 'Bias Detection',
    description: 'Detects potential bias in generated responses',
    category: 'accuracy-and-reliability',
    type: 'llm',
    filename: 'bias-scorer.ts',
    content: `import { createBiasScorer } from '@mastra/evals';
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const biasScorer = createBiasScorer({
  model: openai('gpt-4o-mini'),
});`
  },
  {
    id: 'context-precision',
    name: 'Context Precision',
    description: 'Measures how precisely context is used in responses',
    category: 'context-quality',
    type: 'llm',
    filename: 'context-precision-scorer.ts',
    content: `import { createContextPrecisionScorer } from '@mastra/evals';
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const contextPrecisionScorer = createContextPrecisionScorer({
  model: openai('gpt-4o-mini'),
});`
  },
  {
    id: 'context-relevance',
    name: 'Context Relevance',
    description: 'Evaluates relevance of retrieved context to the query',
    category: 'context-quality',
    type: 'llm',
    filename: 'context-relevance-scorer.ts',
    content: `import { createContextRelevanceScorerLLM } from '@mastra/evals';
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const contextRelevanceScorer = createContextRelevanceScorerLLM({
  model: openai('gpt-4o-mini'),
});`
  },
  {
    id: 'faithfulness',
    name: 'Faithfulness',
    description: 'Measures how faithful the answer is to the given context',
    category: 'accuracy-and-reliability',
    type: 'llm',
    filename: 'faithfulness-scorer.ts',
    content: `import { createFaithfulnessScorer } from '@mastra/evals';
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const faithfulnessScorer = createFaithfulnessScorer({
  model: openai('gpt-4o-mini'),
});`
  },
  {
    id: 'hallucination',
    name: 'Hallucination Detection',
    description: 'Detects hallucinated content in responses',
    category: 'accuracy-and-reliability',
    type: 'llm',
    filename: 'hallucination-scorer.ts',
    content: `import { createHallucinationScorer } from '@mastra/evals';
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const hallucinationScorer = createHallucinationScorer({
  model: openai('gpt-4o-mini'),
});`
  },
  {
    id: 'llm-tool-call-accuracy',
    name: 'Tool Call Accuracy (LLM)',
    description: 'Evaluates accuracy of tool/function calls by LLM',
    category: 'accuracy-and-reliability',
    type: 'llm',
    filename: 'llm-tool-call-accuracy-scorer.ts',
    content: `import { createToolCallAccuracyScorerLLM } from '@mastra/evals';
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define your available tools here
const availableTools = {
  // Example:
  // getTodo: {
  //   description: 'Get a todo item',
  //   parameters: z.object({
  //     id: z.string(),
  //   }),
  //   execute: async ({ id }) => { /* implementation */ }
  // }
};

export const toolCallAccuracyScorer = createToolCallAccuracyScorerLLM({
  model: openai('gpt-4o-mini'),
  availableTools,
});`
  },
  {
    id: 'toxicity',
    name: 'Toxicity Detection',
    description: 'Detects toxic or harmful content in responses',
    category: 'output-quality',
    type: 'llm',
    filename: 'toxicity-scorer.ts',
    content: `import { createToxicityScorer } from '@mastra/evals';
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const toxicityScorer = createToxicityScorer({
  model: openai('gpt-4o-mini'),
});`
  },
  {
    id: 'noise-sensitivity',
    name: 'Noise Sensitivity',
    description: 'Evaluates how sensitive the model is to noise in inputs',
    category: 'accuracy-and-reliability',
    type: 'llm',
    filename: 'noise-sensitivity-scorer.ts',
    content: `import { createNoiseSensitivityScorerLLM } from '@mastra/evals';
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const noiseSensitivityScorer = createNoiseSensitivityScorerLLM({
  model: openai('gpt-4o-mini'),
  baselineResponse: 'Your baseline response here',
  noisyQuery: 'Your noisy query here',
});`
  },
  {
    id: 'prompt-alignment',
    name: 'Prompt Alignment',
    description: 'Evaluates how well responses align with prompt instructions',
    category: 'output-quality',
    type: 'llm',
    filename: 'prompt-alignment-scorer.ts',
    content: `import { createPromptAlignmentScorerLLM } from '@mastra/evals';
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const promptAlignmentScorer = createPromptAlignmentScorerLLM({
  model: openai('gpt-4o-mini'),
});`
  },
  {
    id: 'completeness',
    name: 'Completeness',
    description: 'Evaluates completeness of output based on requirements',
    category: 'output-quality',
    type: 'code',
    filename: 'completeness-scorer.ts',
    content: `import { createCompletenessScorer } from '@mastra/evals';

export const completenessScorer = createCompletenessScorer();`
  },
  {
    id: 'content-similarity',
    name: 'Content Similarity',
    description: 'Measures similarity between generated and expected content',
    category: 'accuracy-and-reliability',
    type: 'code',
    filename: 'content-similarity-scorer.ts',
    content: `import { createContentSimilarityScorer } from '@mastra/evals';

export const contentSimilarityScorer = createContentSimilarityScorer({
  threshold: 0.8, // Similarity threshold (0-1)
});`
  },
  {
    id: 'keyword-coverage',
    name: 'Keyword Coverage',
    description: 'Checks coverage of required keywords in output',
    category: 'output-quality',
    type: 'code',
    filename: 'keyword-coverage-scorer.ts',
    content: `import { createKeywordCoverageScorer } from '@mastra/evals';

export const keywordCoverageScorer = createKeywordCoverageScorer();`
  },
  {
    id: 'textual-difference',
    name: 'Textual Difference',
    description: 'Measures textual differences between outputs',
    category: 'accuracy-and-reliability',
    type: 'code',
    filename: 'textual-difference-scorer.ts',
    content: `import { createTextualDifferenceScorer } from '@mastra/evals';

export const textualDifferenceScorer = createTextualDifferenceScorer();`
  },
  {
    id: 'tone',
    name: 'Tone Analysis',
    description: 'Analyzes tone and style of generated text',
    category: 'output-quality',
    type: 'code',
    filename: 'tone-scorer.ts',
    content: `import { createToneScorer } from '@mastra/evals';

export const toneScorer = createToneScorer({
  expectedTone: 'professional', // Options: 'professional', 'casual', 'friendly', 'formal', 'technical'
});`
  },
  {
    id: 'code-tool-call-accuracy',
    name: 'Tool Call Accuracy (Code)',
    description: 'Evaluates accuracy of code-based tool calls',
    category: 'accuracy-and-reliability',
    type: 'code',
    filename: 'code-tool-call-accuracy-scorer.ts',
    content: `import { createToolCallAccuracyScorerCode } from '@mastra/evals';

// Define your available tools here
const availableTools = {
  // Example:
  // getTodo: {
  //   description: 'Get a todo item',
  //   parameters: z.object({
  //     id: z.string(),
  //   }),
  //   execute: async ({ id }) => { /* implementation */ }
  // }
};

export const codeToolCallAccuracyScorer = createToolCallAccuracyScorerCode({
  availableTools,
});`
  }
];
