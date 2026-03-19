import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PlaygroundTheme = 'dark' | 'light' | 'system';

interface PlaygroundStore {
  requestContext: Record<string, any>;
  theme: PlaygroundTheme;
  setRequestContext: (requestContext: Record<string, any>) => void;
  setTheme: (theme: PlaygroundTheme) => void;
}

export const usePlaygroundStore = create<PlaygroundStore>()(
  persist(
    set => ({
      requestContext: {},
      theme: 'dark',
      setRequestContext: requestContext => set({ requestContext }),
      setTheme: theme => set({ theme }),
    }),
    {
      name: 'mastra-playground-store',
    },
  ),
);
