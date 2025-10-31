import { createScorer } from '@mastra/core/scores';
import Sentiment from 'sentiment';
import type { MastraMessageV2 } from '@mastra/core/agent';
import { getMessageContent } from '../../utils';

interface ToneScorerConfig {
  referenceTone?: string;
}

export function createToneScorer(config: ToneScorerConfig = {}) {
  const { referenceTone } = config;

  return createScorer({
    name: 'Tone Scorer',
    description:
      'Analyzes the tone and sentiment of agent responses using sentiment analysis. Can compare against a reference tone or evaluate sentiment stability.',
    type: 'agent',
  })
    .preprocess(async ({ run }) => {
      const sentiment = new Sentiment();
      const agentMessage: string = run.output?.map((msg: MastraMessageV2) => getMessageContent(msg)).join(', ') || '';
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
