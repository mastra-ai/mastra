import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface AgentInfoPanelContextValue {
  showAgentInfo: boolean;
  toggleAgentInfo: () => void;
}

const AgentInfoPanelContext = createContext<AgentInfoPanelContextValue | null>(null);

export function AgentInfoPanelProvider({ children }: { children: ReactNode }) {
  const [showAgentInfo, setShowAgentInfo] = useState(() => {
    const stored = localStorage.getItem('agent-info-panel-visible');
    return stored === null ? false : stored === 'true';
  });

  const toggleAgentInfo = useCallback(() => {
    setShowAgentInfo(prev => {
      const next = !prev;
      localStorage.setItem('agent-info-panel-visible', String(next));
      return next;
    });
  }, []);

  return (
    <AgentInfoPanelContext.Provider value={{ showAgentInfo, toggleAgentInfo }}>
      {children}
    </AgentInfoPanelContext.Provider>
  );
}

export function useAgentInfoPanel() {
  const context = useContext(AgentInfoPanelContext);
  if (!context) {
    throw new Error('useAgentInfoPanel must be used within AgentInfoPanelProvider');
  }
  return context;
}
