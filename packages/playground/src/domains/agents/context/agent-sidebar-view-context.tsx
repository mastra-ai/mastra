/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type AgentSidebarView = 'threads' | 'memory' | 'versions';

const STORAGE_KEY = 'agent-memory-sidebar-tab-v2';

interface AgentSidebarViewContextValue {
  selectedView: AgentSidebarView;
  setSelectedView: (view: AgentSidebarView) => void;
  openThreads: () => void;
  openMemory: () => void;
  openVersions: () => void;
}

const AgentSidebarViewContext = createContext<AgentSidebarViewContextValue | null>(null);

function getInitialView(): AgentSidebarView {
  if (typeof sessionStorage === 'undefined') return 'threads';

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored === 'memory' ? 'memory' : 'threads';
  } catch {
    return 'threads';
  }
}

function persistView(view: AgentSidebarView) {
  if (view === 'versions' || typeof sessionStorage === 'undefined') return;

  try {
    sessionStorage.setItem(STORAGE_KEY, view);
  } catch {
    // Ignore storage failures; the sidebar view can still work in memory.
  }
}

export function AgentSidebarViewProvider({ children }: { children: React.ReactNode }) {
  const [selectedView, setSelectedViewState] = useState<AgentSidebarView>(getInitialView);

  const setSelectedView = useCallback((view: AgentSidebarView) => {
    setSelectedViewState(view);
    persistView(view);
  }, []);

  const openThreads = useCallback(() => setSelectedView('threads'), [setSelectedView]);
  const openMemory = useCallback(() => setSelectedView('memory'), [setSelectedView]);
  const openVersions = useCallback(() => setSelectedView('versions'), [setSelectedView]);

  const value = useMemo(
    () => ({
      selectedView,
      setSelectedView,
      openThreads,
      openMemory,
      openVersions,
    }),
    [openMemory, openThreads, openVersions, selectedView, setSelectedView],
  );

  return <AgentSidebarViewContext.Provider value={value}>{children}</AgentSidebarViewContext.Provider>;
}

export function useAgentSidebarView() {
  const context = useContext(AgentSidebarViewContext);

  if (!context) {
    throw new Error('useAgentSidebarView must be used within an AgentSidebarViewProvider');
  }

  return context;
}
