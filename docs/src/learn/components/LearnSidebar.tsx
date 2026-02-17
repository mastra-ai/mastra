import { useMemo, useState } from 'react'
import Link from '@docusaurus/Link'
import { useLocation } from '@docusaurus/router'
import { cn } from '@site/src/lib/utils'
import type { Lesson, LearnStorageV1 } from '../types'
import { LearnProgressBar } from './LearnProgressBar'
import { getPublishedCount } from '../utils'

type LearnSidebarProps = {
  lessons: Lesson[]
  storage: LearnStorageV1
  className?: string
}

function ProgressIcon({ storage, slug }: { storage: LearnStorageV1; slug: string }) {
  const p = storage.lessons[slug]
  if (p?.watched) {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
        ✓
      </span>
    )
  }
  if (p && p.seconds > 0) {
    return <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
  }
  return <span className="h-2.5 w-2.5 rounded-full border border-(--border)" />
}

export function LearnSidebar({ lessons, storage, className }: LearnSidebarProps) {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const modules = useMemo(() => {
    const map = new Map<string, Lesson[]>()
    for (const lesson of lessons) {
      const group = map.get(lesson.module) ?? []
      group.push(lesson)
      map.set(lesson.module, group)
    }
    return Array.from(map.entries())
  }, [lessons])

  const publishedTotal = getPublishedCount(lessons)
  const watchedCount = lessons.filter(l => l.status === 'published' && storage.lessons[l.slug]?.watched).length

  const sidebar = (
    <nav className="flex h-full flex-col overflow-y-auto py-4">
      <div className="px-4 pb-4">
        <Link
          to="/learn"
          className="text-base font-semibold text-(--mastra-text-primary) no-underline hover:text-(--mastra-green-accent-2)"
        >
          Mastra 101
        </Link>
        <LearnProgressBar completed={watchedCount} total={publishedTotal} className="mt-3" />
      </div>

      <div className="flex-1">
        {modules.map(([moduleName, moduleLessons]) => (
          <div key={moduleName} className="mb-4">
            <h4 className="px-4 py-1.5 text-xs font-semibold tracking-wide text-(--mastra-text-tertiary) uppercase">
              {moduleName}
            </h4>
            <ul className="m-0 list-none p-0">
              {moduleLessons.map(lesson => {
                const isActive =
                  location.pathname === `/learn/${lesson.slug}` || location.pathname === `/learn/${lesson.slug}/`
                return (
                  <li key={lesson.slug}>
                    <Link
                      to={`/learn/${lesson.slug}`}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'flex items-center gap-2.5 px-4 py-1.5 text-sm no-underline transition-colors',
                        isActive
                          ? 'border-l-2 border-l-green-500 bg-green-500/5 font-medium text-(--mastra-text-primary)'
                          : 'border-l-2 border-l-transparent text-(--mastra-text-secondary) hover:text-(--mastra-text-primary)',
                      )}
                    >
                      <ProgressIcon storage={storage} slug={lesson.slug} />
                      <span className="truncate">{lesson.title}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed right-4 bottom-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-(--border) bg-(--ifm-background-color) text-(--mastra-text-primary) shadow-lg lg:hidden"
        aria-label="Toggle course sidebar"
      >
        ☰
      </button>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-[var(--ifm-navbar-height)] bottom-0 left-0 z-40 w-[var(--doc-sidebar-width)] shrink-0 border-r border-r-(--sidebar-border) bg-(--ifm-background-color) transition-transform lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          className,
        )}
      >
        {sidebar}
      </aside>
    </>
  )
}
