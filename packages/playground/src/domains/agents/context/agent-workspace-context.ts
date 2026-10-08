import { createContext, useContext } from 'react';
import type { RefCallback, RefObject } from 'react';
import type { PanelImperativeHandle } from 'react-resizable-panels';

export interface AgentWorkspaceContextValue {
  navigationTarget: HTMLDivElement;
  registerNavigationTarget: RefCallback<HTMLDivElement>;
  navigationPanel: RefObject<PanelImperativeHandle | null>;
}

export const AgentWorkspaceContext = createContext<AgentWorkspaceContextValue | undefined>(undefined);
export const useAgentWorkspace = () => useContext(AgentWorkspaceContext);
