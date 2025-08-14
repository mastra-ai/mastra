import pMap from 'p-map';
import type { MastraScorer } from './base';
import type { Agent, AiMessageType, UIMessageWithMetadata } from '../agent';
import type { CoreMessage } from 'ai';
import type { RuntimeContext } from '../runtime-context';

type RunExperimentDataItem = {
  input: string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[];
  groundTruth: any;
  runtimeContext?: RuntimeContext;
};

type RunExperimentResult<TScorerName extends string = string> = {
  scores: Record<TScorerName, number>;
  summary: {
    totalItems: number;
    duration: number;
  };
};

export const runExperiment = async <const TScorer extends readonly MastraScorer[]>({
  data,
  scorers,
  target,
  onItemComplete,
  concurrency = 1,
}: {
  data: RunExperimentDataItem[];
  scorers: TScorer;
  target: Agent;
  concurrency?: number;
  onItemComplete?: ({
    item,
    targetResult,
    scorerResults,
  }: {
    item: Record<string, any>;
    targetResult: any;
    scorerResults: Record<string, any>;
  }) => void;
}): Promise<RunExperimentResult<TScorer[number]['name']>> => {
  const startTime = Date.now();
  let totalItems = 0;
  const scoreAccumulators: Record<string, number[]> = {};

  await pMap(
    data,
    async item => {
      const targetResult = await target.generate(item.input, {
        scorers: {},
        returnScorerInputs: true,
        runtimeContext: item.runtimeContext,
      });

      const scorerResults: Record<string, any> = {};
      for (const scorer of scorers) {
        const score = await scorer.run({
          input: targetResult.scoringData?.input,
          output: targetResult.scoringData?.output,
          groundTruth: item.groundTruth,
          runtimeContext: item.runtimeContext,
        });

        scorerResults[scorer.name] = score;
      }

      for (const [scorerName, result] of Object.entries(scorerResults)) {
        if (!scoreAccumulators[scorerName]) {
          scoreAccumulators[scorerName] = [];
        }
        scoreAccumulators[scorerName].push(result.score);
      }

      if (onItemComplete) {
        onItemComplete({ item, targetResult, scorerResults });
      }

      totalItems++;
    },
    { concurrency },
  );

  const averageScores: Record<string, number> = {};
  for (const [scorerName, scores] of Object.entries(scoreAccumulators)) {
    averageScores[scorerName] = scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  return {
    scores: averageScores,
    summary: {
      totalItems,
      duration: Date.now() - startTime,
    },
  };
};
