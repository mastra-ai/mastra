import { Link, useLocation } from 'react-router';
import { cn } from '@/lib/utils';
import { TeamSwitcher } from './team-switcher';
import { LayoutDashboard, Users, FolderGit2, Rocket, Activity, Settings } from 'lucide-react';
import { useCurrentTeam } from '@/hooks/use-current-team';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Teams', href: '/teams', icon: Users },
];

const teamNavigation = [
  { name: 'Projects', href: '/projects', icon: FolderGit2 },
  { name: 'Deployments', href: '/deployments', icon: Rocket },
  { name: 'Observability', href: '/observability', icon: Activity },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const { currentTeam } = useCurrentTeam();

  return (
    <div className="w-64 bg-surface2 border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-lg font-semibold text-neutral9">MastraAdmin</span>
        </Link>
      </div>

      {/* Team Switcher */}
      <div className="p-4 border-b border-border">
        <TeamSwitcher />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map(item => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm',
                isActive ? 'bg-accent1/10 text-accent1' : 'text-neutral6 hover:bg-surface3 hover:text-neutral9',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}

        {currentTeam && (
          <>
            <div className="pt-4 pb-2">
              <span className="px-3 text-xs font-medium text-neutral3 uppercase">Team</span>
            </div>
            {teamNavigation.map(item => {
              const href = `/teams/${currentTeam.id}${item.href}`;
              const isActive = location.pathname.startsWith(href);
              return (
                <Link
                  key={item.name}
                  to={href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm',
                    isActive ? 'bg-accent1/10 text-accent1' : 'text-neutral6 hover:bg-surface3 hover:text-neutral9',
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </>
        )}
      </nav>
    </div>
  );
}
