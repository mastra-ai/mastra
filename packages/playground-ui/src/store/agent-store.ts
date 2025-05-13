import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ModelSettings } from '../types';

interface AgentStore {
  modelSettings: Record<string, ModelSettings>;
  setModelSettings: (modelSettings: Record<string, ModelSettings>) => void;
  chatWithGenerate: Record<string, boolean>;
  setChatWithGenerate: (chatWithGenerate: Record<string, boolean>) => void;
}

export const useAgentStore = create<AgentStore>()(
  persist(
    set => ({
      modelSettings: {},
      setModelSettings: modelSettings => set({ modelSettings }),
      chatWithGenerate: {},
      setChatWithGenerate: chatWithGenerate => set({ chatWithGenerate }),
    }),
    {
      name: 'mastra-agent-store',
    },
  ),
);
