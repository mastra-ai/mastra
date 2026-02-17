import { useState, useEffect, useCallback } from 'react'
import type { LearnStorageV1, LessonProgress } from '../types'

const STORAGE_KEY = 'mastraLearn:v1'

function getDefault(): LearnStorageV1 {
  return { lastVisitedLesson: null, lessons: {} }
}

function readStorage(): LearnStorageV1 {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return getDefault()
    return JSON.parse(raw) as LearnStorageV1
  } catch {
    return getDefault()
  }
}

function writeStorage(data: LearnStorageV1) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function useLearnStorage() {
  const [storage, setStorage] = useState<LearnStorageV1>(getDefault)

  useEffect(() => {
    setStorage(readStorage())
  }, [])

  const updateLesson = useCallback((slug: string, partial: Partial<LessonProgress>) => {
    setStorage(prev => {
      const existing = prev.lessons[slug] ?? { watched: false, seconds: 0, updatedAt: new Date().toISOString() }
      const next: LearnStorageV1 = {
        ...prev,
        lessons: {
          ...prev.lessons,
          [slug]: { ...existing, ...partial, updatedAt: new Date().toISOString() },
        },
      }
      writeStorage(next)
      return next
    })
  }, [])

  const setLastVisited = useCallback((slug: string) => {
    setStorage(prev => {
      const next: LearnStorageV1 = { ...prev, lastVisitedLesson: slug }
      writeStorage(next)
      return next
    })
  }, [])

  return { storage, updateLesson, setLastVisited }
}
