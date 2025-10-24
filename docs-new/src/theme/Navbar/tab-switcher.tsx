import { cn } from '@site/src/css/utils';
import Link from '@docusaurus/Link';
import { useLocation } from '@docusaurus/router';

const docsTabs = [
  {
    id: 'Docs',
    label: 'Docs',
    href: '/docs',
    basePath: '/docs',
  },
  {
    id: 'Models',
    label: 'Models',
    href: '/docs/models',
    basePath: '/docs/models',
  },
  {
    id: 'Examples',
    label: 'Examples',
    href: '/docs/examples',
    basePath: '/docs/examples',
  },
  {
    id: 'Guides',
    label: 'Guides & Migrations',
    href: '/docs/guides',
    basePath: '/docs/guides',
  },
  {
    id: 'Reference',
    label: 'Reference',
    href: '/docs/reference',
    basePath: '/docs/reference',
  },
  {
    id: 'Showcase',
    label: 'Showcase',
    href: '/showcase',
    basePath: '/showcase',
  },
];

export const TabSwitcher = ({ className }: { className?: string }) => {
  const location = useLocation();
  const pathname = location.pathname;
  return (
    <div
      className={cn(
        ' border-b-[0.5px] dark:border-b-[var(--border)] bg-[var(--light-color-surface-15)] dark:bg-[var(--primary-bg)] border-b-(--border-subtle)',
        className,
      )}
    >
      <div className="mx-auto max-w-(--ifm-container-width)">
        <div className="flex tab gap-6 overflow-x-auto py-2 px-5 -ml-3" aria-label="Documentation tabs">
          {docsTabs.map(tab => {
            // Check if current path matches the tab's base path
            // For "Docs" tab, match any path starting with /docs/ that isn't covered by other tabs
            const isActive = (() => {
              // Check if path starts with this tab's base path
              if (pathname.startsWith(tab.basePath + '/') || pathname === tab.basePath) {
                // For the general "Docs" tab, exclude paths that belong to other specific tabs
                if (tab.basePath === '/docs') {
                  const otherTabPaths = docsTabs.filter(t => t.id !== 'Docs').map(t => t.basePath);
                  return !otherTabPaths.some(path => pathname.startsWith(path + '/') || pathname === path);
                }
                return true;
              }
              return false;
            })();

            return (
              <Link
                key={tab.id}
                to={tab.href}
                data-active={isActive}
                className="flex min-w-fit relative gap-1.5 items-center px-0 py-1 text-sm font-medium transition-colors"
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.label}

                {isActive && (
                  <div
                    className="absolute -bottom-2 rounded left-0 w-full h-0.5 bg-(--mastra-text-primary) dark:bg-primary"
                    id="active-tab"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};
