import { Mastra } from '@mastra/core/mastra';

import { supportAgent, interviewerAgent } from './agents';

export const mastra = new Mastra({
  agents: { supportAgent, interviewerAgent },
});
