import { cn } from '@site/src/lib/utils'
import type { LessonStatus } from '../types'

export function LessonStatusChip({ status, className }: { status: LessonStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        status === 'published'
          ? 'bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400'
          : 'bg-yellow-500/10 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400',
        className,
      )}
    >
      {status === 'published' ? 'Published' : 'Coming Soon'}
    </span>
  )
}
