import { Link, useLocation } from 'react-router';
import { cn } from '@/lib/utils';
import { TeamSwitcher } from './team-switcher';
import {
  LayoutDashboard,
  Users,
  FolderGit2,
  Rocket,
  Activity,
  Settings,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { useCurrentTeam } from '@/hooks/use-current-team';
import { useUIStore } from '@/stores/ui-store';

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
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <div
      className={cn(
        'bg-surface2 border-r border-border flex flex-col transition-all duration-200',
        sidebarCollapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          {!sidebarCollapsed && <span className="text-lg font-semibold text-neutral9">MastraAdmin</span>}
          {sidebarCollapsed && <span className="text-lg font-semibold text-neutral9">M</span>}
        </Link>
        <button
          onClick={toggleSidebar}
          className="p-1 text-neutral6 hover:text-neutral9 hover:bg-surface3 rounded"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Team Switcher */}
      {!sidebarCollapsed && (
        <div className="p-4 border-b border-border">
          <TeamSwitcher />
        </div>
      )}

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
                sidebarCollapsed && 'justify-center px-2',
              )}
              title={sidebarCollapsed ? item.name : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && item.name}
            </Link>
          );
        })}

        {currentTeam && (
          <>
            {!sidebarCollapsed && (
              <div className="pt-4 pb-2">
                <span className="px-3 text-xs font-medium text-neutral3 uppercase">Team</span>
              </div>
            )}
            {sidebarCollapsed && <div className="pt-4 border-t border-border mt-2" />}
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
                    sidebarCollapsed && 'justify-center px-2',
                  )}
                  title={sidebarCollapsed ? item.name : undefined}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed && item.name}
                </Link>
              );
            })}
          </>
        )}
      </nav>
    </div>
  );
}
