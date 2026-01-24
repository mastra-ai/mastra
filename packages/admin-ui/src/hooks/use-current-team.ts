import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Team {
  id: string;
  name: string;
  slug: string;
}

interface CurrentTeamState {
  currentTeam: Team | null;
  setCurrentTeam: (team: Team | null) => void;
}

const useCurrentTeamStore = create<CurrentTeamState>()(
  persist(
    set => ({
      currentTeam: null,
      setCurrentTeam: team => set({ currentTeam: team }),
    }),
    {
      name: 'admin-ui-current-team',
    },
  ),
);

export function useCurrentTeam() {
  const { currentTeam, setCurrentTeam } = useCurrentTeamStore();
  return { currentTeam, setCurrentTeam };
}
