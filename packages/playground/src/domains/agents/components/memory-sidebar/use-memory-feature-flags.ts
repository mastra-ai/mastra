import { useMemoryConfig } from '@/domains/memory/hooks';

export interface MemoryFeatureFlags {
  /** Size of the recent-message window, or `undefined` when history is off. */
  lastMessages?: number;
  semanticRecallOn: boolean;
  workingMemoryOn: boolean;
  observationalOn: boolean;
}

/**
 * Reads the agent's memory config and reduces its feature settings to the
 * on/off flags the sidebar renders.
 */
export function useMemoryFeatureFlags(agentId: string): MemoryFeatureFlags {
  const { data: memoryConfig } = useMemoryConfig(agentId);
  const config = memoryConfig?.config;
  const lastMessages = config?.lastMessages === false ? undefined : config?.lastMessages;

  return {
    lastMessages,
    semanticRecallOn: Boolean(config?.semanticRecall),
    workingMemoryOn: Boolean(config?.workingMemory?.enabled),
    observationalOn: Boolean(config?.observationalMemory?.enabled),
  };
}
