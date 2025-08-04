import { createScorer } from '@mastra/core/scores';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/scores';
import Sentiment from 'sentiment';

interface ToneScorerConfig {
  referenceTone?: string;
}

export function createToneScorer(config: ToneScorerConfig = {}) {
  const { referenceTone } = config;

  return createScorer<ScorerRunInputForAgent, ScorerRunOutputForAgent>({
    name: 'Completeness',
    description:
      'Leverage the nlp method from "compromise" to extract elements from the input and output and calculate the coverage.',
  })
    .preprocess(async ({ run }) => {
      const sentiment = new Sentiment();
      const agentMessage: string = run.output?.map((i: { content: string }) => i.content).join(', ') || '';
      const responseSentiment = sentiment.analyze(agentMessage);

      if (referenceTone) {
        // Compare sentiment with reference
        const referenceSentiment = sentiment.analyze(referenceTone);
        const sentimentDiff = Math.abs(responseSentiment.comparative - referenceSentiment.comparative);
        const normalizedScore = Math.max(0, 1 - sentimentDiff);

        return {
          score: normalizedScore,
          responseSentiment: responseSentiment.comparative,
          referenceSentiment: referenceSentiment.comparative,
          difference: sentimentDiff,
        };
      }

      // Evaluate sentiment stability across response
      const sentences = agentMessage.match(/[^.!?]+[.!?]+/g) || [agentMessage];
      const sentiments = sentences.map(s => sentiment.analyze(s).comparative);
      const avgSentiment = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
      const variance = sentiments.reduce((sum, s) => sum + Math.pow(s - avgSentiment, 2), 0) / sentiments.length;
      const stability = Math.max(0, 1 - variance);

      return {
        score: stability,
        avgSentiment,
        sentimentVariance: variance,
      };
    })
    .generateScore(({ results }) => {
      return results.preprocessStepResult?.score;
    });
}
