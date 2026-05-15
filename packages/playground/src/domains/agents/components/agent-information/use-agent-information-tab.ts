import { useState, useCallback } from 'react';

const STORAGE_KEY = 'agent-info-selected-tab';

export interface UseAgentInformationTabArgs {
  isMemoryLoading: boolean;
  hasMemory: boolean;
  hasChannels: boolean;
}

// Valid tab values that can be persisted
const VALID_TABS = new Set(['overview', 'model-settings', 'memory', 'channels', 'request-context', 'tracing-options']);

export const useAgentInformationTab = ({ isMemoryLoading, hasMemory, hasChannels }: UseAgentInformationTabArgs) => {
  const [selectedTab, setSelectedTab] = useState<string>(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY) || 'overview';
    // Validate stored tab is a known valid tab
    if (!VALID_TABS.has(stored)) return 'overview';
    return stored;
  });

  // Compute effective tab - handle unavailable tabs
  const effectiveTab = (() => {
    // Unknown tab values fall back to overview
    if (!VALID_TABS.has(selectedTab)) return 'overview';
    // Memory tab requires memory to be available
    if (selectedTab === 'memory' && !isMemoryLoading && !hasMemory) {
      return 'overview';
    }
    // Channels tab requires channels to be available
    if (selectedTab === 'channels' && !hasChannels) {
      return 'overview';
    }
    return selectedTab;
  })();

  const handleTabChange = useCallback((value: string) => {
    setSelectedTab(value);
    sessionStorage.setItem(STORAGE_KEY, value);
  }, []);

  return {
    selectedTab: effectiveTab,
    handleTabChange,
  };
};
