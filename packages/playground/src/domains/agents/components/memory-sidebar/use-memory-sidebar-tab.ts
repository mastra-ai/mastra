import { useState, useCallback } from 'react';

// v2: the "configuration" tab became "memory" when the static memory config
// moved to the agent settings view; a new key invalidates stale stored values.
const STORAGE_KEY = 'agent-memory-sidebar-tab-v2';

export const useMemorySidebarTab = () => {
  const [selectedTab, setSelectedTab] = useState<string>(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY) || 'threads';
    return stored === 'threads' || stored === 'memory' ? stored : 'threads';
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
