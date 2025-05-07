import { Mastra } from '@mastra/core';

import { synthesizeAgent, weatherAgent } from './agents';
import { weatherWorkflow } from './workflows';
import { planningAgent } from './agents/planning';
import { branchingWorkflow } from './workflows/branched';

export const mastra = new Mastra({
  agents: { weatherAgent, planningAgent, synthesizeAgent },
  workflows: { weatherWorkflow },
  vnext_workflows: { branchingWorkflow },
});
