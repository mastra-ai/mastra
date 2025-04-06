import type { EvaluationResult } from '@mastra/core';
import stringSimilarity from 'string-similarity';
import { CodeEvaluator } from '../evaluator';

interface ContentSimilarityOptions {
  ignoreCase?: boolean;
  ignoreWhitespace?: boolean;
}

async function score({
  input,
  output,
  options = {},
}: {
  input: string;
  output: string;
  options?: ContentSimilarityOptions;
}): Promise<EvaluationResult> {
  const defaultOptions = {
    ignoreCase: true,
    ignoreWhitespace: true,
    ...options,
  };

  let processedInput = input;
  let processedOutput = output;

  if (defaultOptions.ignoreCase) {
    processedInput = processedInput.toLowerCase();
    processedOutput = processedOutput.toLowerCase();
  }

  if (defaultOptions.ignoreWhitespace) {
    processedInput = processedInput.replace(/\s+/g, ' ').trim();
    processedOutput = processedOutput.replace(/\s+/g, ' ').trim();
  }

  const similarity = stringSimilarity.compareTwoStrings(processedInput, processedOutput);

  return {
    score: similarity,
    info: {
      details: { similarity },
    },
  };
}

export class ContentSimilarity extends CodeEvaluator {
  constructor(options: ContentSimilarityOptions = {}) {
    super(score, options);
  }
}
