import { Txt } from '@mastra/playground-ui/components/Txt';
import { GitPullRequest, Inbox } from 'lucide-react';
import type { ComponentType } from 'react';
import { NavLink } from 'react-router';

import { useOverlays } from '../../../lib/overlays/overlays';
import { useActiveProjectContext } from '../../workspaces/context/ActiveProjectProvider';
import { useGithubStatusQuery } from '../../workspaces/hooks/useGithubStatus';

/**
 * Sidebar navigation for the Factory pages. Factory data comes from GitHub, so
 * the section only renders for GitHub-backed projects (mirroring
 * WorkspacesSection) while the GitHub feature is enabled and connected.
 */
export function FactorySection() {
  const { activeProject } = useActiveProjectContext();
  const isGithubProject = activeProject?.source === 'github';
  const { data: status } = useGithubStatusQuery(isGithubProject);

  if (!isGithubProject) return null;
  if (!status?.enabled || !status.connected) return null;

  return (
    <nav className="flex flex-col gap-2" aria-label="Factory">
      <div className="flex items-center justify-between px-1">
        <Txt as="span" variant="ui-xs" className="text-icon3 uppercase tracking-wide">
          Factory
        </Txt>
      </div>
      <div className="flex flex-col gap-1">
        <FactoryLink to="/factory/intake" icon={Inbox} label="Intake" />
        <FactoryLink to="/factory/review" icon={GitPullRequest} label="Review" />
      </div>
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
