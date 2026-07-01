import type { GetMemoryConfigResponse } from '@mastra/client-js';
import { useMemoryConfig } from '@/domains/memory/hooks';

type LastMessagesConfig = GetMemoryConfigResponse['config']['lastMessages'];

export interface MemoryFeatureFlags {
  /** Size of the recent-message window, or `undefined` when history is off. */
  lastMessages?: number;
  semanticRecallOn: boolean;
  workingMemoryOn: boolean;
  observationalOn: boolean;
}

function getLastMessagesWindow(lastMessages: LastMessagesConfig): number | undefined {
  if (lastMessages === false) return undefined;
  return lastMessages;
}

/**
 * Reads the agent's memory config and reduces its feature settings to the
 * on/off flags the sidebar renders.
 */
export function useMemoryFeatureFlags(agentId: string): MemoryFeatureFlags {
  const { data: memoryConfig } = useMemoryConfig(agentId);
  const config = memoryConfig?.config;

  return {
    lastMessages: getLastMessagesWindow(config?.lastMessages),
    semanticRecallOn: Boolean(config?.semanticRecall),
    workingMemoryOn: Boolean(config?.workingMemory?.enabled),
    observationalOn: Boolean(config?.observationalMemory?.enabled),
  };
}
