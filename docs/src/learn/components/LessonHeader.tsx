import { useState } from 'react'
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
  const [animating, setAnimating] = useState(false)

  return (
    <div className={cn('mb-6', className)}>
      <div className="mb-2 flex items-center gap-3">
        <span className="learn-meta-text text-sm">
          Lesson {lessonNumber} of {totalLessons}
        </span>
        <span className="learn-meta-text">·</span>
        <span className="learn-meta-text text-sm">{lesson.durationMin} min</span>
        <span className="learn-meta-text">·</span>
        <LessonStatusChip status={lesson.status} />
        {onWatchedChange != null && (
          <label className="ml-auto flex cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={watched ?? false}
              onChange={e => {
                setAnimating(true)
                onWatchedChange(e.target.checked)
              }}
              className="sr-only"
            />
            <span className="learn-meta-text text-sm">{watched ? 'Watched' : 'Mark as watched'}</span>
            <span
              className={cn('learn-watched-icon', watched && 'is-watched', animating && 'is-animate')}
              onAnimationEnd={() => setAnimating(false)}
            >
              {watched && '✓'}
            </span>
          </label>
        )}
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-(--mastra-text-primary)">{lesson.title}</h1>
    </div>
  )
}
