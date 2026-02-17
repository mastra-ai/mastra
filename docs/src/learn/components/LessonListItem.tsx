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
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs text-white">✓</span>
    )
  }
  if (status === 'in-progress') {
    return <span className="h-3 w-3 rounded-full bg-yellow-500" />
  }
  return <span className="h-3 w-3 rounded-full border border-(--border)" />
}

export function LessonListItem({ lesson, index, storage, className }: LessonListItemProps) {
  const progressStatus = getProgressStatus(storage, lesson.slug)

  const buttonLabel = (() => {
    if (lesson.status === 'comingSoon') return 'Preview'
    if (progressStatus === 'in-progress') return 'Continue'
    if (progressStatus === 'completed') return 'Review'
    return 'Start'
  })()

  return (
    <Link
      to={`/learn/${lesson.slug}`}
      className={cn(
        'group flex items-center gap-4 rounded-lg border border-(--border) p-4 no-underline transition-colors hover:border-(--mastra-green-accent-2)',
        className,
      )}
    >
      <div className="flex h-8 w-8 items-center justify-center">
        <ProgressDot status={progressStatus} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-(--mastra-text-primary)">
            {index + 1}. {lesson.title}
          </span>
          <LessonStatusChip status={lesson.status} />
        </div>
        <span className="text-xs text-(--mastra-text-tertiary)">{lesson.durationMin} min</span>
      </div>
      <span className="shrink-0 rounded-md border border-(--border) px-3 py-1 text-xs font-medium text-(--mastra-text-secondary) transition-colors group-hover:border-(--mastra-green-accent-2) group-hover:text-(--mastra-text-primary)">
        {buttonLabel}
      </span>
    </Link>
  )
}
