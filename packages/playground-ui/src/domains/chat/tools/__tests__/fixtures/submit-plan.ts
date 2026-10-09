import type { GetAgentPlanResponse } from '@mastra/client-js';

export const submittedPlanPath = '.mastracode/plans/add-dark-mode.md';

export const submittedPlanFile: GetAgentPlanResponse = {
  path: submittedPlanPath,
  content: '# Add dark mode\n\nUse semantic color tokens throughout the interface.',
};
