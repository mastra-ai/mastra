import { useState, useCallback } from 'react';

const STORAGE_KEY = 'agent-memory-sidebar-tab';

const VALID_TABS = new Set(['threads', 'configuration']);

export const useMemorySidebarTab = () => {
  const [selectedTab, setSelectedTab] = useState<string>(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY) || 'threads';
    if (!VALID_TABS.has(stored)) return 'threads';
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
