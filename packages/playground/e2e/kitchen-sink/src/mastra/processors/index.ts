import type { Processor } from '@mastra/core/processors';

export const loggingProcessor: Processor<'logging-processor'> = {
  id: 'logging-processor',
  name: 'Logging Processor',
  description: 'Logs all input messages for debugging',
  processInput: async args => args.messages,
};

export const contentFilterProcessor: Processor<'content-filter'> = {
  id: 'content-filter',
  name: 'Content Filter Processor',
  description: 'Filters content based on rules',
  processInput: async args => args.messages,
  processOutputResult: async args => args.messages,
};
