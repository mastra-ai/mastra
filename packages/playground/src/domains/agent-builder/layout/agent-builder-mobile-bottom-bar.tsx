import { AgentIcon } from '@mastra/playground-ui';
import { LibraryIcon, StarIcon } from 'lucide-react';
import { useLocation } from 'react-router';
import { useLinkComponent } from '@/lib/framework';

const links = [
  { name: 'Agents', url: '/agent-builder/agents', icon: <AgentIcon /> },
  { name: 'Favorites', url: '/agent-builder/favorite', icon: <StarIcon className="size-5" /> },
  { name: 'Library', url: '/agent-builder/library', icon: <LibraryIcon className="size-5" /> },
];

export function AgentBuilderMobileBottomBar() {
  const { Link } = useLinkComponent();
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border1 bg-surface1/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-3">
        {links.map(link => {
          const isActive = pathname.startsWith(link.url);
          return (
            <li key={link.name}>
              <Link
                href={link.url}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-1 py-2 text-[11px] transition-colors duration-normal ease-out-custom ${
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
