import { Mastra } from '@mastra/core';

import { weatherAgent, synthesizeAgent, activityPlannerAgent } from './agents';
import { weatherWorkflow } from './workflows';
import { weatherWorkflow as step1Workflow } from './workflows/step1';
import { weatherWorkflow as step2Workflow } from './workflows/step2';
import { weatherWorkflow as step3Workflow } from './workflows/step3';
import { weatherWorkflow as step4Workflow } from './workflows/step4';
import { incrementWorkflow as step5Workflow } from './workflows/step5';
import { planningAgent } from './agents/planning';
import { travelAgent } from './agents/travelAgent';

export const mastra = new Mastra({
  agents: { weatherAgent, synthesizeAgent, activityPlannerAgent, planningAgent, travelAgent },
  workflows: { weatherWorkflow },
  vnext_workflows: {
    step1Workflow,
    step2Workflow,
    step3Workflow,
    step4Workflow,
    step5Workflow,
  },
});
