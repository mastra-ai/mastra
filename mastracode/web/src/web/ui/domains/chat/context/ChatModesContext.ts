import type { AgentControllerModeInfo } from '@mastra/client-js';
import { createContext } from 'react';

export interface ChatModesApi {
  modes: AgentControllerModeInfo[];
  activeMode: AgentControllerModeInfo | undefined;
  activeModeId: string | undefined;
  isSwitchingMode: boolean;
  setMode: (modeId: string) => Promise<void>;
}

export const ChatModesContext = createContext<ChatModesApi | null>(null);
