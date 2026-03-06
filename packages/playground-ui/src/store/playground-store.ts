import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlaygroundStore {
  requestContext: Record<string, unknown>;
  setRequestContext: (requestContext: Record<string, unknown>) => void;
}

export const usePlaygroundStore = create<PlaygroundStore>()(
  persist(
    set => ({
      requestContext: {},
      setRequestContext: requestContext => set({ requestContext }),
    }),
    {
      name: 'mastra-playground-store',
    },
  ),
);
