import {Agent} from '@mastra/core/agent';
import {Workflow} from '@mastra/core/workflows';

export const consolidateApps = (
  apps: {
    agents: Record<string, Agent>;
    workflows: Record<string, Workflow>;
  }[],
) =>
  apps.reduce(
    (acc, app) => {
      acc.agents = {...acc.agents, ...app.agents};
      acc.workflows = {...acc.workflows, ...app.workflows};
      return acc;
    },
    {
      agents: {},
      workflows: {},
    },
  );
