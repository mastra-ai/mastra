import type { ObservationFocus } from '@mastra/memory/experiments';
import { MemoryConfigOptions } from './data/types';

const semanticRecall = {
  topK: 10,
  messageRange: 2,
  scope: 'resource',
} as const;

const lastMessages = 10;

// Focus areas for LongMemEval - prioritize personal facts since that's what the benchmark tests
const longMemEvalFocus: ObservationFocus = {
  include: [
    'personal-facts', // Education, work history, family - critical for LongMemEval
    'preferences', // User preferences
    'temporal', // Dates and times mentioned
    'relationships', // People and relationships
    'tasks', // Current tasks and goals
    'health', // Health information
    'location', // Location information
  ],
};

// Observational Memory configuration
// These thresholds allow more context to accumulate before triggering observation/reflection
export const observationalMemoryConfig = {
  // Using defaults: observationThreshold: 10000, reflectionThreshold: 30000
  // observationThreshold: { min: 4000, max: 6000 },
  // reflectionThreshold: { min: 12000, max: 18000 },
  // Resource scope for cross-session memory
  scope: 'resource',
  // Focus areas for the observer
  focus: longMemEvalFocus,
} as const;

export function getMemoryOptions(memoryConfig: string): MemoryConfigOptions {
  switch (memoryConfig) {
    case 'semantic-recall':
      return {
        type: 'semantic-recall',
        options: {
          lastMessages,
          semanticRecall,
          workingMemory: { enabled: false },
        },
      };

    case 'working-memory':
      return {
        type: 'working-memory',
        options: {
          lastMessages,
          semanticRecall: false,
          workingMemory: {
            enabled: true,
            scope: 'resource',
            version: 'vnext',
          },
        },
      };

    // tailored means a custom working memory template is passed in per-question - to align with how working memory is intended to be used to track specific relevant information.
    case 'working-memory-tailored':
      return {
        type: 'working-memory',
        options: {
          lastMessages,
          semanticRecall: false,
          workingMemory: {
            enabled: true,
            scope: 'resource',
            version: 'vnext',
          },
        },
      };

    // Combined means semantic recall + working memory
    case 'combined':
      return {
        type: 'combined',
        options: {
          lastMessages,
          semanticRecall,
          workingMemory: {
            enabled: true,
            scope: 'resource',
          },
        },
      };

    case 'combined-tailored':
      return {
        type: 'combined-tailored',
        options: {
          lastMessages,
          semanticRecall,
          workingMemory: {
            enabled: true,
            scope: 'resource',
            version: 'vnext',
          },
        },
      };

    case 'observational-memory':
      // Observational Memory uses its own processor, minimal Memory config
      return {
        type: 'observational-memory',
        options: {
          lastMessages: 5, // OM handles context, just keep minimal recent
          semanticRecall: false,
          workingMemory: { enabled: false },
        },
      };

    default:
      throw new Error(`Unknown memory config: ${memoryConfig}`);
  }
}
