import type { ScorerTemplate } from './types';

export const AVAILABLE_SCORERS: Array<ScorerTemplate> = [
  // Accuracy and Reliability scorers
  {
    id: 'answer-relevancy',
    name: 'Answer Relevancy',
    description: 'Evaluates how well responses address the input query using LLM',
    category: 'accuracy-and-reliability',
    filename: 'answer-relevancy-scorer.ts',
  },
  {
    id: 'faithfulness',
    name: 'Faithfulness',
    description: 'Measures how accurately responses represent provided context',
    category: 'accuracy-and-reliability',
    filename: 'faithfulness-scorer.ts',
  },
  {
    id: 'hallucination',
    name: 'Hallucination Detection',
    description: 'Detects facts or claims not present in provided context',
    category: 'accuracy-and-reliability',
    filename: 'hallucination-scorer.ts',
  },
  {
    id: 'completeness',
    name: 'Completeness',
    description: 'Checks if responses include all necessary information',
    category: 'accuracy-and-reliability',
    filename: 'completeness-scorer.ts',
  },
  {
    id: 'content-similarity',
    name: 'Content Similarity',
    description: 'Evaluates consistency of information across different phrasings',
    category: 'accuracy-and-reliability',
    filename: 'content-similarity-scorer.ts',
  },
  {
    id: 'textual-difference',
    name: 'Textual Difference',
    description: 'Measures textual differences between strings',
    category: 'accuracy-and-reliability',
    filename: 'textual-difference-scorer.ts',
  },

  // Output Quality scorers
  {
    id: 'tone-consistency',
    name: 'Tone Consistency',
    description: 'Measures consistency in formality, complexity, and style',
    category: 'output-quality',
    filename: 'tone-consistency-scorer.ts',
  },
  {
    id: 'toxicity-detection',
    name: 'Toxicity Detection',
    description: 'Detects harmful or inappropriate content in responses',
    category: 'output-quality',
    filename: 'toxicity-detection-scorer.ts',
  },
  {
    id: 'bias-detection',
    name: 'Bias Detection',
    description: 'Detects potential biases in output',
    category: 'output-quality',
    filename: 'bias-detection-scorer.ts',
  },
  {
    id: 'keyword-coverage',
    name: 'Keyword Coverage',
    description: 'Assesses how well output covers important keywords from input',
    category: 'output-quality',
    filename: 'keyword-coverage-scorer.ts',
  },
];
