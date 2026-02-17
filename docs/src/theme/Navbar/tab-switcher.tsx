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
    label: 'Guides & Migrations',
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
]

export const TabSwitcher = ({ className }: { className?: string }) => {
  const location = useLocation()
  const pathname = location.pathname
  return (
    <div className={cn('-mb-0.5 bg-(--light-color-surface-15) px-4 dark:bg-(--primary-bg)', className)}>
      <div className="w-full">
        <div className="tab -ml-3 flex gap-6 overflow-x-auto px-5 py-2" aria-label="Documentation tabs">
          {docsTabs.map(tab => {
            // Check if current path matches the tab's base path
            // For "Docs" tab, match any path starting with /docs/ that isn't covered by other tabs
            const isActive = (() => {
              // Check if path starts with this tab's base path
              if (pathname.startsWith(tab.basePath + '/') || pathname === tab.basePath) {
                return true
              }
              return false
            })()

            return (
              <Link
                key={tab.id}
                to={tab.href}
                data-active={isActive}
                className="relative flex min-w-fit items-center gap-1.5 px-0 py-1 text-sm font-medium transition-colors"
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.label}

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
