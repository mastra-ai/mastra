import { cn } from '@site/src/lib/utils'
import type { Lesson } from '../types'
import { LessonStatusChip } from './LessonStatusChip'

type LessonHeaderProps = {
  lesson: Lesson
  lessonNumber: number
  totalLessons: number
  watched?: boolean
  onWatchedChange?: (checked: boolean) => void
  className?: string
}

export function LessonHeader({
  lesson,
  lessonNumber,
  totalLessons,
  watched,
  onWatchedChange,
  className,
}: LessonHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      <div className="mb-2 flex items-center gap-3">
        <span className="text-sm text-(--mastra-text-tertiary)">
          Lesson {lessonNumber} of {totalLessons}
        </span>
        <span className="text-(--mastra-text-tertiary)">·</span>
        <span className="text-sm text-(--mastra-text-tertiary)">{lesson.durationMin} min</span>
        <LessonStatusChip status={lesson.status} />
        {onWatchedChange != null && (
          <label className="ml-auto flex items-center gap-2">
            <input
              type="checkbox"
              checked={watched ?? false}
              onChange={e => onWatchedChange(e.target.checked)}
              className="h-4 w-4 rounded border-gray-400 text-green-500 accent-green-500"
            />
            <span className="text-sm text-(--mastra-text-tertiary)">Mark as watched</span>
          </label>
        )}
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-(--mastra-text-primary)">{lesson.title}</h1>
    </div>
  )
}
