import React from 'react'
import { NavbarSecondaryMenuFiller, type NavbarSecondaryMenuComponent } from '@docusaurus/theme-common'
import { useNavbarMobileSidebar } from '@docusaurus/theme-common/internal'
import Link from '@docusaurus/Link'
import { useLocation } from '@docusaurus/router'
import { cn } from '@site/src/lib/utils'
import type { Lesson, LearnStorageV1, LessonStatus } from '../types'
import { LearnProgressBar } from './LearnProgressBar'
import { getPublishedCount } from '../utils'

type LearnMobileSidebarProps = {
  lessons: Lesson[]
  storage: LearnStorageV1
}

function ProgressIcon({ storage, slug, status }: { storage: LearnStorageV1; slug: string; status: LessonStatus }) {
  if (status === 'comingSoon') {
    return <span className="learn-sidebar-icon-coming-soon" />
  }
  const p = storage.lessons[slug]
  if (p?.watched) {
    return <span className="learn-watched-icon is-watched">✓</span>
  }
  if (p && p.seconds > 0) {
    return <span className="h-5 w-5 shrink-0 rounded-full border-2 border-yellow-500" />
  }
  return <span className="learn-sidebar-icon-unwatched" />
}

const LearnMobileSidebarContent: NavbarSecondaryMenuComponent<LearnMobileSidebarProps> = ({ lessons, storage }) => {
  const location = useLocation()
  const mobileSidebar = useNavbarMobileSidebar()
  const publishedTotal = getPublishedCount(lessons)
  const watchedCount = lessons.filter(l => l.status === 'published' && storage.lessons[l.slug]?.watched).length

  const modules = React.useMemo(() => {
    const map = new Map<string, Lesson[]>()
    for (const lesson of lessons) {
      const group = map.get(lesson.module) ?? []
      group.push(lesson)
      map.set(lesson.module, group)
    }
    return Array.from(map.entries())
  }, [lessons])

  return (
    <div className="learn-sidebar px-2 py-3">
      <div className="mb-3 px-2">
        <LearnProgressBar completed={watchedCount} total={publishedTotal} totalLessons={lessons.length} />
      </div>
      <ul className="learn-sidebar menu__list">
        {modules.map(([moduleName, moduleLessons]) => (
          <li key={moduleName}>
            <h4 className="px-2 py-1 text-xs font-semibold text-(--mastra-text-tertiary)">{moduleName}</h4>
            <ul className="learn-sidebar menu__list">
              {moduleLessons.map(lesson => {
                const isActive =
                  location.pathname === `/learn/${lesson.slug}` || location.pathname === `/learn/${lesson.slug}/`
                const isComingSoon = lesson.status === 'comingSoon'
                return (
                  <li key={lesson.slug} className="menu__list-item">
                    <Link
                      to={`/learn/${lesson.slug}`}
                      onClick={() => mobileSidebar.toggle()}
                      className={cn(
                        'learn-sidebar-item flex items-center gap-2 px-2 py-1.5 text-sm',
                        isActive
                          ? 'font-medium text-(--mastra-green-accent-3) dark:text-(--mastra-green-accent)'
                          : isComingSoon
                            ? 'text-(--mastra-text-muted)'
                            : 'text-(--mastra-text-tertiary)',
                      )}
                    >
                      <ProgressIcon storage={storage} slug={lesson.slug} status={lesson.status} />
                      <span>{lesson.title}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LearnMobileSidebarComponent(props: LearnMobileSidebarProps) {
  return <NavbarSecondaryMenuFiller component={LearnMobileSidebarContent} props={props} />
}

export const LearnMobileSidebar = React.memo(LearnMobileSidebarComponent)
