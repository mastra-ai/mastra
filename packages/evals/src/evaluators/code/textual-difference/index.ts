import type { EvaluationResult } from '@mastra/core';
import { SequenceMatcher } from 'difflib';
import { CodeEvaluator } from '../evaluator';

export interface TextualDifferenceOptions {
  isCaseSensitive?: boolean;
  ignoreWhitespace?: boolean;
}

async function score({
  input,
  output,
  options = {},
}: {
  input: string;
  output: string;
  options?: TextualDifferenceOptions;
}): Promise<EvaluationResult> {
  const defaultOptions = {
    isCaseSensitive: false,
    ignoreWhitespace: false,
    ...options,
  };

  // Preprocess text based on options
  let processedInput = input;
  let processedOutput = output;

  if (!defaultOptions.isCaseSensitive) {
    processedInput = processedInput.toLowerCase();
    processedOutput = processedOutput.toLowerCase();
  }

  if (defaultOptions.ignoreWhitespace) {
    processedInput = processedInput.replace(/\s+/g, ' ').trim();
    processedOutput = processedOutput.replace(/\s+/g, ' ').trim();
  }

  const matcher = new SequenceMatcher(null, processedInput, processedOutput);
  const ratio = matcher.ratio();

  // Get detailed operations
  const ops = matcher.getOpcodes();
  const changes = ops.filter(([op]) => op !== 'equal').length;

  // Calculate confidence based on text length difference
  const maxLength = Math.max(processedInput.length, processedOutput.length);
  const lengthDiff = maxLength > 0 ? Math.abs(processedInput.length - processedOutput.length) / maxLength : 0;
  const confidence = 1 - lengthDiff;

  return {
    score: ratio,
    info: {
      ratio,
      changes,
      lengthDiff,
      confidence,
      operations: ops.map(([op, i1, i2, j1, j2]) => ({
        operation: op,
        inputStart: i1,
        inputEnd: i2,
        outputStart: j1,
        outputEnd: j2,
        inputText: processedInput.slice(i1, i2),
        outputText: processedOutput.slice(j1, j2),
      })),
    },
  };
}

export class TextualDifference extends CodeEvaluator {
  constructor(options: TextualDifferenceOptions = {}) {
    super(score, options);
  }
}
