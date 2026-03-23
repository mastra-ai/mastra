import { Mastra } from '@mastra/core/mastra';

import {
  fiscalAnalyst,
  healthAnalyst,
  defenseAnalyst,
  technologyAnalyst,
  civilRightsAnalyst,
  environmentalAnalyst,
  synthesizer,
} from './agents';
import { legislativeCouncilWorkflow, legislativeCouncilWithDeliberationWorkflow } from './workflows';

export const mastra = new Mastra({
  agents: {
    fiscalAnalyst,
    healthAnalyst,
    defenseAnalyst,
    technologyAnalyst,
    civilRightsAnalyst,
    environmentalAnalyst,
    synthesizer,
  },
  workflows: {
    legislativeCouncilWorkflow,
    legislativeCouncilWithDeliberationWorkflow,
  },
});
