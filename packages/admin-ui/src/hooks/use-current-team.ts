import { useTeamStore } from '@/stores/team-store';

export function useCurrentTeam() {
  const { currentTeam, setCurrentTeam, clearCurrentTeam } = useTeamStore();
  return { currentTeam, setCurrentTeam, clearCurrentTeam };
}
