import Link from '@docusaurus/Link'
import { cn } from '@site/src/lib/utils'
import type { Lesson, LearnStorageV1 } from '../types'
import { LessonStatusChip } from './LessonStatusChip'
import type { LessonProgressStatus } from '../hooks/useLessonProgress'

type LessonListItemProps = {
  lesson: Lesson
  index: number
  storage: LearnStorageV1
  className?: string
}

function getProgressStatus(storage: LearnStorageV1, slug: string): LessonProgressStatus {
  const p = storage.lessons[slug]
  if (!p) return 'not-started'
  if (p.watched) return 'completed'
  if (p.seconds > 0) return 'in-progress'
  return 'not-started'
}

function ProgressDot({ status }: { status: LessonProgressStatus }) {
  if (status === 'completed') {
    return <span className="learn-watched-icon is-watched">✓</span>
  }
  if (status === 'in-progress') {
    return <span className="learn-sidebar-icon-in-progress" />
  }
  return <span className="learn-sidebar-icon-unwatched" />
}

export function LessonListItem({ lesson, index, storage, className }: LessonListItemProps) {
  const isComingSoon = lesson.status === 'comingSoon'
  const progressStatus = isComingSoon ? 'not-started' : getProgressStatus(storage, lesson.slug)

  const buttonLabel = (() => {
    if (isComingSoon) return 'Coming Early March 2026'
    if (progressStatus === 'in-progress') return 'Continue'
    if (progressStatus === 'completed') return 'Review'
    return 'Start'
  })()

  const sharedClassName = cn(
    'learn-link group flex items-center gap-4 rounded-lg border border-(--border) p-4 transition-colors cursor-pointer',
    isComingSoon ? 'opacity-60' : 'hover:border-(--mastra-green-accent-3) dark:hover:border-(--mastra-green-accent)',
    className,
  )

  if (isComingSoon) {
    return (
      <a
        href="#learn-signup-cta"
        onClick={e => {
          e.preventDefault()
          document.getElementById('learn-signup-cta')?.scrollIntoView({ behavior: 'smooth' })
        }}
        className={sharedClassName}
      >
        <div className="flex h-8 w-8 items-center justify-center">
          <span className="learn-sidebar-icon-coming-soon" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-(--mastra-text-primary) no-underline">
              {index + 1}. {lesson.title}
            </span>
          </div>
          <span className="text-xs text-(--mastra-text-tertiary)">{lesson.durationMin} min</span>
        </div>
        <LessonStatusChip status={lesson.status} />
      </a>
    )
  }

  return (
    <Link to={`/learn/${lesson.slug}`} className={sharedClassName}>
      <div className="flex h-8 w-8 items-center justify-center">
        <ProgressDot status={progressStatus} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-(--mastra-text-primary) no-underline">
            {index + 1}. {lesson.title}
          </span>
        </div>
        <span className="text-xs text-(--mastra-text-tertiary)">{lesson.durationMin} min</span>
      </div>
      <span className="shrink-0 rounded-md border border-(--border) px-3 py-1 text-xs font-medium text-(--mastra-text-secondary) transition-colors group-hover:border-(--mastra-green-accent-3) group-hover:text-(--mastra-text-primary) dark:group-hover:border-(--mastra-green-accent)">
        {buttonLabel}
      </span>
    </Link>
  )
}
