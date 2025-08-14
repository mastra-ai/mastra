import type { CoreMessage } from 'ai';
import pMap from 'p-map';
import type { Agent, AiMessageType, UIMessageWithMetadata } from '../agent';
import { MastraError } from '../error';
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

  if (data.length === 0) {
    throw new MastraError({
      domain: 'SCORER',
      id: 'RUN_EXPERIMENT_FAILED_NO_DATA_PROVIDED',
      category: 'USER',
      text: 'Failed to run experiment: Data array is empty',
    });
  }

  if (scorers.length === 0) {
    throw new MastraError({
      domain: 'SCORER',
      id: 'RUN_EXPERIMENT_FAILED_NO_SCORERS_PROVIDED',
      category: 'USER',
      text: 'Failed to run experiment: No scorers provided',
    });
  }

  if (!target) {
    throw new MastraError({
      domain: 'SCORER',
      id: 'RUN_EXPERIMENT_FAILED_NO_TARGET_PROVIDED',
      category: 'USER',
      text: 'Failed to run experiment: No target provided',
    });
  }

  await pMap(
    data,
    async item => {
      let targetResult: any;
      try {
        targetResult = await target.generate(item.input, {
          scorers: {},
          returnScorerInputs: true,
          runtimeContext: item.runtimeContext,
        });
      } catch (error) {
        throw new MastraError(
          {
            domain: 'SCORER',
            id: 'RUN_EXPERIMENT_TARGET_FAILED_TO_GENERATE_RESULT',
            category: 'USER',
            text: 'Failed to run experiment: Error generating result from target',
            details: {
              item: JSON.stringify(item),
            },
          },
          error,
        );
      }

      const scorerResults: ScorerResults<TScorer> = {} as ScorerResults<TScorer>;
      for (const scorer of scorers) {
        try {
          const score = await scorer.run({
            input: targetResult.scoringData?.input,
            output: targetResult.scoringData?.output,
            groundTruth: item.groundTruth,
            runtimeContext: item.runtimeContext,
          });

          scorerResults[scorer.name as keyof ScorerResults<TScorer>] =
            score as ScorerResults<TScorer>[typeof scorer.name];
        } catch (error) {
          throw new MastraError(
            {
              domain: 'SCORER',
              id: 'RUN_EXPERIMENT_SCORER_FAILED_TO_SCORE_RESULT',
              category: 'USER',
              text: `Failed to run experiment: Error running scorer ${scorer.name}`,
              details: {
                scorerName: scorer.name,
                item: JSON.stringify(item),
              },
            },
            error,
          );
        }
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
