import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlaygroundStore {
  runtimeContext: Record<string, any>;
  setRuntimeContext: (runtimeContext: Record<string, any>) => void;
}

export const usePlaygroundStore = create<PlaygroundStore>()(
  persist(
    set => ({
      runtimeContext: {},
      setRuntimeContext: runtimeContext => set({ runtimeContext }),
    }),
    {
      name: 'mastra-playground-store',
    },
  ),
);
