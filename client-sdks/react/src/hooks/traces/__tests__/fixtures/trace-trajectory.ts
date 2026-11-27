import type { MastraClient } from '@mastra/client-js';

type TrajectoryResponse = Awaited<ReturnType<MastraClient['getTraceTrajectory']>>;

export const weatherTrajectory: TrajectoryResponse = {
  steps: [
    { stepType: 'model_generation', name: 'gen' },
    {
      stepType: 'tool_call',
      name: "tool: 'getWeather'",
      toolArgs: { city: 'Seattle' },
      toolResult: { temp: 52 },
    },
  ],
  totalDurationMs: 1200,
};
