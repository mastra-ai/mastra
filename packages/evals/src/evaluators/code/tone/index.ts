import type { EvaluationResult } from '@mastra/core/eval';
import Sentiment from 'sentiment';
import { CodeEvaluator } from '../evaluator';

export interface ToneOptions {
  language?: string;
  extras?: Record<string, number>;
}

async function score({ input, output }: { input: string; output: string }): Promise<EvaluationResult> {
  const sentiment = new Sentiment();
  const responseSentiment = sentiment.analyze(input);

  if (output) {
    // Compare sentiment with reference
    const referenceSentiment = sentiment.analyze(output);
    const sentimentDiff = Math.abs(responseSentiment.comparative - referenceSentiment.comparative);
    const normalizedScore = Math.max(0, 1 - sentimentDiff);

    return {
      score: normalizedScore,
      info: {
        responseSentiment: responseSentiment.comparative,
        referenceSentiment: referenceSentiment.comparative,
        difference: sentimentDiff,
      },
    };
  }

  // Evaluate sentiment stability across response
  const sentences = input.match(/[^.!?]+[.!?]+/g) || [input];
  const sentiments = sentences.map(s => sentiment.analyze(s).comparative);
  const avgSentiment = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
  const variance = sentiments.reduce((sum, s) => sum + Math.pow(s - avgSentiment, 2), 0) / sentiments.length;
  const stability = Math.max(0, 1 - variance);

  return {
    score: stability,
    info: {
      avgSentiment,
      sentimentVariance: variance,
    },
  };
}

export class ToneConsistency extends CodeEvaluator {
  constructor(options: ToneOptions = {}) {
    super(score, options);
  }
}
