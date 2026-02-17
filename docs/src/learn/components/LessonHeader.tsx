import { cn } from '@site/src/lib/utils'
import type { Lesson } from '../types'
import { LessonStatusChip } from './LessonStatusChip'

type LessonHeaderProps = {
  lesson: Lesson
  lessonNumber: number
  totalLessons: number
  className?: string
}

export function LessonHeader({ lesson, lessonNumber, totalLessons, className }: LessonHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      <div className="mb-2 flex items-center gap-3">
        <span className="text-sm text-(--mastra-text-tertiary)">
          Lesson {lessonNumber} of {totalLessons}
        </span>
        <span className="text-(--mastra-text-tertiary)">·</span>
        <span className="text-sm text-(--mastra-text-tertiary)">{lesson.durationMin} min</span>
        <LessonStatusChip status={lesson.status} />
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-(--mastra-text-primary)">{lesson.title}</h1>
    </div>
  )
}
