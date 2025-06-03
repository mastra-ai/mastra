import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ModelSettings } from '../types';

interface AgentStore {
  modelSettings: Record<string, ModelSettings | null>;
  setModelSettings: (modelSettings: Record<string, ModelSettings | null>) => void;
  chatWithGenerate: Record<string, boolean>;
  setChatWithGenerate: (chatWithGenerate: Record<string, boolean>) => void;
}

export const useAgentStore = create<AgentStore>()(
  persist(
    set => ({
      modelSettings: {},
      setModelSettings: modelSettings =>
        set(state => ({ modelSettings: { ...state.modelSettings, ...modelSettings } })),
      chatWithGenerate: {},
      setChatWithGenerate: chatWithGenerate =>
        set(state => ({ chatWithGenerate: { ...state.chatWithGenerate, ...chatWithGenerate } })),
    }),
    {
      name: 'mastra-agent-store',
    },
  ),
);
