import { defaultExecutionPolicy } from '../../src/mastra/contracts/execution-policy.ts';

// Controlled providers do not spend money. Keep fixture runs large enough to exercise complete journeys.
export const fixturePolicy = {
  ...defaultExecutionPolicy,
  maxPhysicalCalls: 3000,
  budgetUsd: 100,
  maxRunElapsedMs: 86400000,
};
