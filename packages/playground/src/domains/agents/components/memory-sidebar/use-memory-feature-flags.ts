import { useMemoryConfig } from '@/domains/memory/hooks';

// A memory feature may be configured as a plain boolean or as an object that
// carries `{ enabled }` (plus extra options), so normalize both shapes.
type ToggleConfig = boolean | { enabled?: boolean } | null | undefined;

function isEnabled(value: ToggleConfig): boolean {
  return typeof value === 'object' ? Boolean(value?.enabled) : Boolean(value);
}

export interface MemoryFeatureFlags {
  /** Size of the recent-message window, or `undefined` when history is off. */
  lastMessages?: number;
  semanticRecallOn: boolean;
  workingMemoryOn: boolean;
  observationalOn: boolean;
}

/**
 * Reads the agent's memory config and reduces its loosely-typed feature settings
 * to the on/off flags the sidebar renders, keeping that parsing out of the view.
 */
export function useMemoryFeatureFlags(agentId: string): MemoryFeatureFlags {
  const { data: memoryConfig } = useMemoryConfig(agentId);
  const config = memoryConfig?.config;

  return {
    lastMessages: typeof config?.lastMessages === 'number' ? config.lastMessages : undefined,
    semanticRecallOn: Boolean(config?.semanticRecall),
    workingMemoryOn: isEnabled(config?.workingMemory),
    observationalOn: isEnabled(config?.observationalMemory),
  };
}
