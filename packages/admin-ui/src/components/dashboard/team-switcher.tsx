import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTeams } from '@/hooks/teams/use-teams';
import { useCurrentTeam } from '@/hooks/use-current-team';

export function TeamSwitcher() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: teams } = useTeams();
  const { currentTeam, setCurrentTeam } = useCurrentTeam();

  const handleSelect = (teamId: string) => {
    const team = teams?.data.find(t => t.id === teamId);
    if (team) {
      setCurrentTeam(team);
      setOpen(false);
      navigate(`/teams/${team.id}`);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-surface3 border border-border rounded-md text-sm text-neutral9 hover:bg-surface4"
      >
        {currentTeam?.name ?? 'Select team...'}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface3 border border-border rounded-md shadow-lg z-50">
          <div className="p-2">
            <input
              type="text"
              placeholder="Search teams..."
              className="w-full px-3 py-2 bg-surface2 border border-border rounded-md text-sm text-neutral9 focus:outline-none focus:ring-2 focus:ring-accent1"
            />
          </div>

          <div className="max-h-60 overflow-auto">
            {teams?.data && teams.data.length > 0 ? (
              <div className="p-1">
                {teams.data.map(team => (
                  <button
                    key={team.id}
                    onClick={() => handleSelect(team.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral9 hover:bg-surface4 rounded-md"
                  >
                    <Check className={cn('h-4 w-4', currentTeam?.id === team.id ? 'opacity-100' : 'opacity-0')} />
                    {team.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-2 text-sm text-neutral6 text-center">No teams found</div>
            )}
          </div>

          <div className="border-t border-border p-1">
            <button
              onClick={() => {
                setOpen(false);
                navigate('/teams/new');
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral9 hover:bg-surface4 rounded-md"
            >
              <Plus className="h-4 w-4" />
              Create Team
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
