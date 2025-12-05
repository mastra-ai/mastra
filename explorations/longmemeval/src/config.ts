import { MemoryConfigOptions } from './data/types';

const semanticRecall = {
  topK: 10,
  messageRange: 2,
  scope: 'resource',
} as const;

const lastMessages = 10;

// Observational Memory configuration
// These thresholds are tuned for LongMemEval's session-based structure
export const observationalMemoryConfig = {
  // Observer triggers after ~500 tokens of new messages (roughly 5-10 exchanges)
  historyThreshold: { min: 400, max: 600 },
  // Reflector triggers when observations exceed ~2000 tokens
  observationThreshold: { min: 1500, max: 2500 },
  // Resource scope for cross-session memory
  resourceScope: true,
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
