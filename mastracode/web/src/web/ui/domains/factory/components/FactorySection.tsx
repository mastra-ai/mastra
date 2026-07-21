import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChartLine, LayoutDashboard, ScrollText, SquareKanban } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { NavLink } from 'react-router';

import { useOverlays } from '../../../lib/overlays';
import { isGithubFactory, useActiveFactoryContext, useGithubStatusQuery } from '../../workspaces';

/**
 * The Factory menu: Board navigation plus whatever the caller nests under it
 * (the factory Sessions list). Factory work is GitHub-backed, so the section
 * only renders for GitHub factories; the Board link additionally requires the
 * GitHub integration to be enabled and connected, while the nested sessions
 * work off the factory's own worktrees.
 */
export function FactorySection({ children }: { children?: ReactNode }) {
  const { activeFactory } = useActiveFactoryContext();
  const isGithub = activeFactory ? isGithubFactory(activeFactory) : false;
  const { data: status } = useGithubStatusQuery(isGithub);

  if (!isGithub) return null;

  const showBoard = Boolean(status?.enabled && status.connected);

  return (
    <nav className="flex flex-col gap-2" aria-label="Factory">
      <div className="flex items-center justify-between px-1">
        <Txt as="span" variant="ui-xs" className="text-icon3 uppercase tracking-wide">
          Factory
        </Txt>
      </div>
      {showBoard && (
        <div className="flex flex-col gap-1">
          <FactoryLink to="/factory/overview" icon={LayoutDashboard} label="Overview" />
          <FactoryLink to="/factory/board" icon={SquareKanban} label="Board" />
          <FactoryLink to="/factory/metrics" icon={ChartLine} label="Metrics" />
          <FactoryLink to="/factory/audit" icon={ScrollText} label="Audit" />
        </div>
      )}
      {children}
    </nav>
  );
}

function FactoryLink({ to, icon: Icon, label }: { to: string; icon: ComponentType<{ size?: number }>; label: string }) {
  const overlays = useOverlays();

  return (
    <NavLink
      to={to}
      onClick={() => overlays.close('sidebar')}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-md px-2 py-1.5 text-xs no-underline transition ${isActive ? 'bg-surface4 text-icon6' : 'text-icon3 hover:bg-surface3 hover:text-icon5'}`
      }
    >
      <Icon size={13} />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}
