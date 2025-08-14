// export const runExperiment = async ({
//   data,
//   scorers,
//   agent,
// }: {
//   dataset: Record<string, any>[];
//   scorers: MastraScorers;
//   agent: Agent;
// }) => {
//   for (const item of data) {

import type { MastraScorer } from './base';

//     const result = await agent.generate(item.input, item.input.options);

//     for (const scorer of scorers) {
//       const result = await scorer.score(result);
//       console.log(result);
//     }
//   }

//   return {
//     result,
//     scorers,
//     agent,
//   }
// };

// /**
//  * pass scorers to generate
//  * return message list details from generate for scorers
//  */

export const runExperiment = async ({
  data,
  scorers,
  target,
  onItemComplete,
}: {
  data: Record<string, any>[] | Record<string, any>;
  scorers: MastraScorer[];
  target: any;
  onItemComplete?: ({
    item,
    targetResult,
    scoreResults,
  }: {
    item: Record<string, any>;
    targetResult: any;
    scoreResults: Record<string, any>;
  }) => void;
}) => {
  const startTime = Date.now();
  let totalItems = 0;
  const scoreAccumulators: Record<string, number[]> = {};

  if (Array.isArray(data)) {
    for (const item of data) {
      const targetResult = await target.generate(item.input, { scorers: {}, ...item.input.options });

      const scoreResults: Record<string, any> = {};
      for (const scorer of scorers) {
        const score = await scorer.run({
          input: targetResult.messageWindow,
          output: targetResult.assistantResponse,
          groundTruth: item.groundTruth,
        });

        scoreResults[scorer.name] = score;
      }
      totalItems++;
      for (const [scorerName, result] of Object.entries(scoreResults)) {
        if (!scoreAccumulators[scorerName]) {
          scoreAccumulators[scorerName] = [];
        }
        scoreAccumulators[scorerName].push(result.score);
      }

      if (onItemComplete) {
        onItemComplete({ item, targetResult, scoreResults });
      }
    }
  } else {
    const targetResult = await target.generate(data.input, { scorers: {}, ...data.input.options });

    const scoreResults: Record<string, any> = {};
    for (const scorer of scorers) {
      const score = await scorer.run({
        input: targetResult.messageWindow,
        output: targetResult.assistantResponse,
        groundTruth: data.groundTruth,
      });

      scoreResults[scorer.name] = score;
    }
    totalItems++;
    for (const [scorerName, result] of Object.entries(scoreResults)) {
      if (!scoreAccumulators[scorerName]) {
        scoreAccumulators[scorerName] = [];
      }
      scoreAccumulators[scorerName].push(result.score);
    }

    if (onItemComplete) {
      onItemComplete({ item: data, targetResult, scoreResults });
    }
  }

  const averageScores: Record<string, number> = {};
  for (const [scorerName, scores] of Object.entries(scoreAccumulators)) {
    averageScores[scorerName] = scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  return {
    totalItems,
    averageScores,
    duration: Date.now() - startTime,
  };
};
