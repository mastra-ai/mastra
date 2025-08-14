import type { CoreMessage } from 'ai';
import pMap from 'p-map';
import type { Agent, AiMessageType, UIMessageWithMetadata } from '../agent';
import type { RuntimeContext } from '../runtime-context';
import type { MastraScorer } from './base';

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

// Extract the return type of a scorer's run method
type ScorerRunResult<T extends MastraScorer<any, any, any, any>> =
  T extends MastraScorer<any> ? Awaited<ReturnType<T['run']>> : never;

// Create a mapped type for scorer results
type ScorerResults<TScorers extends readonly MastraScorer<any, any, any, any>[]> = {
  [K in TScorers[number]['name']]: ScorerRunResult<Extract<TScorers[number], { name: K }>>;
};

export type RunExperimentOnItemComplete<TScorers extends readonly MastraScorer<any, any, any, any>[]> = ({
  item,
  targetResult,
  scorerResults,
}: {
  item: RunExperimentDataItem;
  targetResult: any;
  scorerResults: ScorerResults<TScorers>;
}) => void;

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
  onItemComplete?: RunExperimentOnItemComplete<TScorer>;
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

      const scorerResults: ScorerResults<TScorer> = {} as ScorerResults<TScorer>;
      for (const scorer of scorers) {
        const score = await scorer.run({
          input: targetResult.scoringData?.input,
          output: targetResult.scoringData?.output,
          groundTruth: item.groundTruth,
          runtimeContext: item.runtimeContext,
        });

        scorerResults[scorer.name as keyof ScorerResults<TScorer>] =
          score as ScorerResults<TScorer>[typeof scorer.name];
      }

      for (const [scorerName, result] of Object.entries(scorerResults)) {
        if (!scoreAccumulators[scorerName]) {
          scoreAccumulators[scorerName] = [];
        }
        scoreAccumulators[scorerName].push((result as { score: number }).score);
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
