import { Mastra } from '@mastra/core/mastra';
import { weatherWorkflow } from './weather-workflow';

export const mastra = new Mastra({
  workflows: {
    weatherWorkflow,
  },
});
