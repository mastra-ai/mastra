import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { Blocks, LibraryIcon, ServerCogIcon, StarIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useLocation } from 'react-router';
import { useBuilderAgentAccess } from '@/domains/agent-builder/hooks/use-builder-agent-access';
import { useBuilderAgentFeatures } from '@/domains/agent-builder/hooks/use-builder-agent-features';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useLinkComponent } from '@/lib/framework';

interface MobileLink {
  name: string;
  url: string;
  icon: React.ReactNode;
}

const agentsLink: MobileLink = { name: 'Agents', url: '/agent-builder/agents', icon: <AgentIcon /> };
const skillsLink: MobileLink = {
  name: 'Skills',
  url: '/agent-builder/skills',
  icon: <Blocks className="size-5" />,
};
const favoritesLink: MobileLink = {
  name: 'Favorites',
  url: '/agent-builder/favorite',
  icon: <StarIcon className="size-5" />,
};
const libraryLink: MobileLink = {
  name: 'Library',
  url: '/agent-builder/library',
  icon: <LibraryIcon className="size-5" />,
};
const infrastructureLink: MobileLink = {
  name: 'Infra',
  url: '/agent-builder/infrastructure',
  icon: <ServerCogIcon className="size-5" />,
};

export function AgentBuilderMobileBottomBar() {
  const { Link } = useLinkComponent();
  const { pathname } = useLocation();
  const features = useBuilderAgentFeatures();
  const { canManageSkills, canUseFavorites } = useBuilderAgentAccess();
  const { hasPermission } = usePermissions();
  const canViewInfrastructure = hasPermission('infrastructure:read');

  const links = useMemo(() => {
    const result: MobileLink[] = [agentsLink];
    if (features.skills && canManageSkills) {
      result.push(skillsLink);
    }
    if (canUseFavorites) {
      result.push(favoritesLink);
    }
    result.push(libraryLink);
    if (canViewInfrastructure) {
      result.push(infrastructureLink);
    }
    return result;
  }, [features.skills, canManageSkills, canUseFavorites, canViewInfrastructure]);

  return (
    <nav
      aria-label="Primary"
      className="border-border1 bg-surface1/95 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}>
        {links.map(link => {
          const isActive = pathname.startsWith(link.url);
          return (
            <li key={link.name}>
              <Link
                href={link.url}
                aria-current={isActive ? 'page' : undefined}
                className={`duration-normal ease-out-custom relative flex flex-col items-center justify-center gap-1 py-2 text-[11px] transition-colors ${
                  isActive
                    ? 'text-icon6 before:absolute before:inset-x-0 before:-top-px before:h-0.5 before:bg-current'
                    : 'text-icon3 hover:text-icon6'
                }`}
              >
                <span className="flex size-6 items-center justify-center" aria-hidden="true">
                  {link.icon}
                </span>
                <span className="leading-none">{link.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
