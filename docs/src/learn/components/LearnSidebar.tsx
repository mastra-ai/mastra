import { useMemo } from 'react'
import Link from '@docusaurus/Link'
import { useLocation } from '@docusaurus/router'
import { cn } from '@site/src/lib/utils'
import { ThemeSwitcher } from '@site/src/components/theme-switcher'
import type { Lesson, LearnStorageV1, LessonStatus } from '../types'
import { LearnProgressBar } from './LearnProgressBar'
import { getPublishedCount } from '../utils'

type LearnSidebarProps = {
  lessons: Lesson[]
  storage: LearnStorageV1
  mobileOpen: boolean
  onMobileToggle: () => void
  className?: string
}

function ProgressIcon({ storage, slug, status }: { storage: LearnStorageV1; slug: string; status: LessonStatus }) {
  if (status === 'comingSoon') {
    return <span className="learn-sidebar-icon-coming-soon" />
  }
  const p = storage.lessons[slug]
  if (p?.watched) {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
        ✓
      </span>
    )
  }
  if (p && p.seconds > 0) {
    return <span className="h-4 w-4 shrink-0 rounded-full border-2 border-yellow-500" />
  }
  return <span className="h-4 w-4 shrink-0 rounded-full border-2 border-(--border)" />
}

export function LearnSidebar({ lessons, storage, mobileOpen, onMobileToggle, className }: LearnSidebarProps) {
  const location = useLocation()

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
    <nav className="learn-sidebar flex h-full flex-col overflow-y-auto py-4">
      <div className="px-4 pb-4">
        <Link
          to="/learn"
          className="learn-link text-sm font-semibold text-(--mastra-text-primary) hover:text-(--mastra-green-accent-2)"
        >
          Mastra Learn
        </Link>
        <LearnProgressBar
          completed={watchedCount}
          total={publishedTotal}
          totalLessons={lessons.length}
          className="mt-3"
        />
      </div>

      <div className="flex-1">
        {modules.map(([moduleName, moduleLessons]) => (
          <div key={moduleName} className="mb-3">
            <h4 className="px-4 py-1 text-xs font-semibold text-(--mastra-text-tertiary)">{moduleName}</h4>
            <ul>
              {moduleLessons.map(lesson => {
                const isActive =
                  location.pathname === `/learn/${lesson.slug}` || location.pathname === `/learn/${lesson.slug}/`
                const isComingSoon = lesson.status === 'comingSoon'
                return (
                  <li key={lesson.slug}>
                    <Link
                      to={`/learn/${lesson.slug}`}
                      onClick={() => mobileOpen && onMobileToggle()}
                      className={cn(
                        'learn-sidebar-item relative flex items-center gap-2 px-4 py-1 text-sm transition-colors',
                        isActive
                          ? 'font-medium text-(--mastra-green-accent-3) dark:text-(--mastra-green-accent)'
                          : isComingSoon
                            ? 'text-(--mastra-text-muted) hover:text-(--mastra-text-tertiary)'
                            : 'text-(--mastra-text-tertiary) hover:text-(--mastra-green-accent-3) dark:hover:text-(--mastra-green-accent)',
                      )}
                    >
                      <ProgressIcon storage={storage} slug={lesson.slug} status={lesson.status} />
                      <span className="truncate">{lesson.title}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Color mode toggle */}
      <footer className="mr-4 flex justify-end border-t-[0.5px] border-(--border) py-2 pr-0.5">
        <ThemeSwitcher />
      </footer>
    </nav>
  )

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && <div className="learn-mobile-overlay" onClick={onMobileToggle} />}

      {/* Sidebar */}
      <aside className={cn('learn-sidebar-container', mobileOpen && 'is-open', className)}>{sidebar}</aside>
    </>
  )
}
