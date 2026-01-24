import { useCurrentTeam } from '@/hooks/use-current-team';

export function DashboardHome() {
  const { currentTeam } = useCurrentTeam();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-neutral9 mb-6">Dashboard</h1>

      {currentTeam ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="p-6 bg-surface2 rounded-lg border border-border">
            <h3 className="text-sm font-medium text-neutral6 mb-2">Current Team</h3>
            <p className="text-xl font-semibold text-neutral9">{currentTeam.name}</p>
          </div>

          <div className="p-6 bg-surface2 rounded-lg border border-border">
            <h3 className="text-sm font-medium text-neutral6 mb-2">Projects</h3>
            <p className="text-xl font-semibold text-neutral9">-</p>
          </div>

          <div className="p-6 bg-surface2 rounded-lg border border-border">
            <h3 className="text-sm font-medium text-neutral6 mb-2">Deployments</h3>
            <p className="text-xl font-semibold text-neutral9">-</p>
          </div>
        </div>
      ) : (
        <div className="p-6 bg-surface2 rounded-lg border border-border text-center">
          <p className="text-neutral6 mb-4">Select a team to get started</p>
        </div>
      )}
    </div>
  );
}
