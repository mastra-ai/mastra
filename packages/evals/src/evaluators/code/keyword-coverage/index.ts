import type { EvaluationResult } from '@mastra/core';
import keyword_extractor from 'keyword-extractor';
import { CodeEvaluator } from '../evaluator';

interface KeywordCoverageOptions {
  language?: string;
  removeDigits?: boolean;
  returnChangedCase?: boolean;
  removeDuplicates?: boolean;
}

async function score({
  input,
  output,
  options = {},
}: {
  input: string;
  output: string;
  options?: KeywordCoverageOptions;
}): Promise<EvaluationResult> {
  const defaultOptions = {
    language: 'english',
    removeDigits: true,
    returnChangedCase: true,
    removeDuplicates: true,
    ...options,
  };

  // Handle empty strings case
  if (!input && !output) {
    return {
      score: 1,
      info: {
        details: {
          totalKeywords: 0,
          matchedKeywords: 0,
        },
      },
    };
  }

  const extractKeywords = (text: string) => {
    return keyword_extractor.extract(text, {
      language: defaultOptions.language as any,
      remove_digits: defaultOptions.removeDigits,
      return_changed_case: defaultOptions.returnChangedCase,
      remove_duplicates: defaultOptions.removeDuplicates,
    });
  };

  const referenceKeywords = new Set(extractKeywords(input));
  const responseKeywords = new Set(extractKeywords(output));

  const matchedKeywords = [...referenceKeywords].filter(k => responseKeywords.has(k));
  const totalKeywords = referenceKeywords.size;
  const coverage = totalKeywords > 0 ? matchedKeywords.length / totalKeywords : 0;

  return {
    score: coverage,
    info: {
      details: {
        totalKeywords: referenceKeywords.size,
        matchedKeywords: matchedKeywords.length,
        matchedKeywordsList: matchedKeywords,
        referenceKeywordsList: [...referenceKeywords],
        responseKeywordsList: [...responseKeywords],
      },
    },
  };
}

export class KeywordCoverage extends CodeEvaluator {
  constructor(options: KeywordCoverageOptions = {}) {
    super(score, options);
  }
}
