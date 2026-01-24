import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Team {
  id: string;
  name: string;
  slug: string;
}

interface TeamState {
  currentTeam: Team | null;
  setCurrentTeam: (team: Team | null) => void;
  clearCurrentTeam: () => void;
}

export const useTeamStore = create<TeamState>()(
  persist(
    set => ({
      currentTeam: null,
      setCurrentTeam: team => set({ currentTeam: team }),
      clearCurrentTeam: () => set({ currentTeam: null }),
    }),
    {
      name: 'admin-ui-current-team',
    },
  ),
);
