import { z } from 'zod';
import type { Processor } from '@mastra/core/processors';
import type { ProcessorProvider, ProcessorPhase } from '@mastra/core/processor-provider';

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

export const loggingProcessorProvider: ProcessorProvider = {
  info: {
    id: 'logging-processor',
    name: 'Logging Processor',
    description: 'Logs all input messages for debugging',
  },
  configSchema: z.object({}),
  availablePhases: ['processInput'] as ProcessorPhase[],
  createProcessor() {
    return loggingProcessor;
  },
};

export const contentFilterProcessorProvider: ProcessorProvider = {
  info: {
    id: 'content-filter',
    name: 'Content Filter Processor',
    description: 'Filters content based on rules',
  },
  configSchema: z.object({}),
  availablePhases: ['processInput', 'processOutputResult'] as ProcessorPhase[],
  createProcessor() {
    return contentFilterProcessor;
  },
};
