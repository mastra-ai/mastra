import { useState, useCallback } from 'react';

const STORAGE_KEY = 'agent-info-selected-tab';

// Valid tab values that can be persisted
const VALID_TABS = new Set(['overview', 'request-context', 'tracing-options']);

export const useAgentInformationTab = () => {
  const [selectedTab, setSelectedTab] = useState<string>(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY) || 'overview';
    // Validate stored tab is a known valid tab
    if (!VALID_TABS.has(stored)) return 'overview';
    return stored;
  });

  const handleTabChange = useCallback((value: string) => {
    setSelectedTab(value);
    sessionStorage.setItem(STORAGE_KEY, value);
  }, []);

  return {
    selectedTab,
    handleTabChange,
  };
};
