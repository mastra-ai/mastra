import { cn } from '@site/src/lib/utils'
import type { LessonStatus } from '../types'

type LessonStatusChipProps = {
  status: LessonStatus
  module?: string
  className?: string
}

export function LessonStatusChip({ status, module, className }: LessonStatusChipProps) {
  if (status === 'published') return null

  const label = module === 'Production' ? 'Coming soon' : 'Coming next week'

  return (
    <span
      className={cn(
        'learn-status-coming-soon inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        className,
      )}
    >
      {label}
    </span>
  )
}
