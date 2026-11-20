import { useState, useCallback, useEffect } from 'react';

// v2: the "configuration" tab became "memory" when the static memory config
// moved to the agent settings view; a new key invalidates stale stored values.
const STORAGE_KEY = 'agent-memory-sidebar-tab-v2';

export const useMemorySidebarTab = () => {
  const [selectedTab, setSelectedTab] = useState('threads');

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored === 'threads' || stored === 'memory') setSelectedTab(stored);
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }
  }, []);

  const handleTabChange = useCallback((value: string) => {
    setSelectedTab(value);
    try {
      sessionStorage.setItem(STORAGE_KEY, value);
    } catch {
      // The active tab still works without persistence.
    }
  }, []);

  return {
    selectedTab,
    handleTabChange,
  };
};
