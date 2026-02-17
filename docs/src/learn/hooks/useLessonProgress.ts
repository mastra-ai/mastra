import { useCallback, useMemo } from 'react'
import { useSharedLearnStorage } from './LearnStorageContext'

export type LessonProgressStatus = 'completed' | 'in-progress' | 'not-started'

export function useLessonProgress(slug: string) {
  const { storage, updateLesson, setLastVisited } = useSharedLearnStorage()

  const progress = storage.lessons[slug]
  const watched = progress?.watched ?? false
  const seconds = progress?.seconds ?? 0

  const status: LessonProgressStatus = useMemo(() => {
    if (watched) return 'completed'
    if (seconds > 0) return 'in-progress'
    return 'not-started'
  }, [watched, seconds])

  const setWatched = useCallback(
    (value: boolean) => {
      updateLesson(slug, { watched: value })
    },
    [slug, updateLesson],
  )

  const setSeconds = useCallback(
    (value: number) => {
      updateLesson(slug, { seconds: value })
    },
    [slug, updateLesson],
  )

  return { watched, seconds, status, setWatched, setSeconds, setLastVisited, storage }
}
