import Link from '@docusaurus/Link'
import { cn } from '@site/src/lib/utils'
import type { Lesson, LearnStorageV1 } from '../types'
import { formatSeconds } from '../utils'

type ContinueCardProps = {
  storage: LearnStorageV1
  lessons: Lesson[]
  className?: string
}

export function ContinueCard({ storage, lessons, className }: ContinueCardProps) {
  // Find the first published lesson the user hasn't watched yet
  const nextLesson = lessons.find(l => l.status === 'published' && !storage.lessons[l.slug]?.watched)
  if (!nextLesson) return null

  const slug = nextLesson.slug
  const lesson = nextLesson
  const progress = storage.lessons[slug]
  const hasTimestamp = progress && progress.seconds > 10

  return (
    <Link
      to={`/learn/${slug}`}
      className={cn(
        'flex items-center justify-between rounded-lg border border-(--border) p-4 no-underline transition-colors hover:border-(--mastra-green-accent-3) dark:hover:border-(--mastra-green-accent)',
        className,
      )}
    >
      <div>
        <p className="text-xs font-medium tracking-wide text-(--mastra-text-tertiary) uppercase">Continue learning</p>
        <p className="mt-1 text-base font-medium text-(--mastra-text-primary)">{lesson.title}</p>
        {hasTimestamp && (
          <p className="mt-0.5 text-sm text-(--mastra-text-tertiary)">
            Resume video at {formatSeconds(progress.seconds)}
          </p>
        )}
      </div>
      <span className="text-2xl text-(--mastra-text-tertiary)">→</span>
    </Link>
  )
}
