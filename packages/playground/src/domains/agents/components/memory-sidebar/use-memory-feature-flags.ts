import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useMemoryConfig } from '@mastra/react/hooks';
import { getRecentMessagesSettings } from './lib/recent-messages';

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
  const { data: memoryConfig } = useMemoryConfig({
    agentId: agentId,
    requestContext: useEntityRequestContext('agent', agentId)[0],
    queryOptions: { enabled: Boolean(agentId) },
  });
  const config = memoryConfig?.config;

  return {
    recentMessages: getRecentMessagesSettings(config?.lastMessages, config?.messageHistory),
    semanticRecallOn: Boolean(config?.semanticRecall),
    workingMemoryOn: Boolean(config?.workingMemory?.enabled),
    observationalOn: Boolean(config?.observationalMemory?.enabled),
  };
}
