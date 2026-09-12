import { getRecentMessagesSettings } from './lib/recent-messages';
import { useMemoryConfig } from '@/domains/memory/hooks';

export interface MemoryFeatureFlags {
  recentMessages: ReturnType<typeof getRecentMessagesSettings>;
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

  return {
    recentMessages: getRecentMessagesSettings(config?.lastMessages, config?.messageTokens),
    semanticRecallOn: Boolean(config?.semanticRecall),
    workingMemoryOn: Boolean(config?.workingMemory?.enabled),
    observationalOn: Boolean(config?.observationalMemory?.enabled),
  };
}
