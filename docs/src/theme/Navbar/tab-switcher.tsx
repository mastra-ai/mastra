import { cn } from '@site/src/lib/utils'
import Link from '@docusaurus/Link'
import { useLocation } from '@docusaurus/router'

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
    href: '/models',
    basePath: '/models',
  },
  {
    id: 'Guides',
    label: 'Guides',
    href: '/guides',
    basePath: '/guides',
  },
  {
    id: 'Reference',
    label: 'Reference',
    href: '/reference',
    basePath: '/reference',
  },
  {
    id: 'Learn',
    label: 'Learn',
    href: '/learn',
    basePath: '/learn',
  },
  {
    id: 'Platform',
    label: 'Platform',
    href: '/docs/mastra-platform/overview',
    basePath: '/docs/mastra-platform',
  },
]

const matchesBasePath = (pathname: string, basePath: string) =>
  pathname.startsWith(basePath + '/') || pathname === basePath

export const TabSwitcher = ({ className }: { className?: string }) => {
  const location = useLocation()
  const pathname = location.pathname
  return (
    <div className={cn('-mb-0.5 bg-(--light-color-surface-15) px-4 dark:bg-(--primary-bg)', className)}>
      <div className="w-full">
        <div className="tab -ml-3 flex gap-6 overflow-x-auto px-5 py-2" aria-label="Documentation tabs">
          {docsTabs.map(tab => {
            const matchesTabPath = matchesBasePath(pathname, tab.basePath)
            const isActive =
              tab.id === 'Docs'
                ? matchesTabPath &&
                  !docsTabs.some(otherTab => otherTab.id !== 'Docs' && matchesBasePath(pathname, otherTab.basePath))
                : matchesTabPath

            return (
              <Link
                key={tab.id}
                to={tab.href}
                data-active={isActive}
                className="relative flex min-w-fit items-center gap-1.5 px-0 py-1 text-sm font-medium transition-colors"
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.label}
                {'badge' in tab && tab.badge && <span className="learn-tab-badge">{tab.badge}</span>}

                {isActive && (
                  <div
                    className="dark:bg-primary absolute -bottom-2 left-0 h-0.5 w-full rounded bg-(--mastra-text-primary)"
                    id="active-tab"
                  />
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
