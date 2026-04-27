import { useState, useEffect, useCallback } from 'react'
import type { LearnStorageV1, LessonProgress } from '../types'

const STORAGE_KEY = 'mastraLearn:v1'

function getDefault(): LearnStorageV1 {
  return { lastVisitedLesson: null, lessons: {} }
}

function readStorage(): LearnStorageV1 {
  if (typeof window === 'undefined') return getDefault()
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
    setStorage(() => {
      // Always read fresh from localStorage to avoid race conditions between
      // multiple setStorage calls and the initial useEffect hydration
      const current = readStorage()
      const existing = current.lessons[slug] ?? { watched: false, seconds: 0, updatedAt: new Date().toISOString() }
      const next: LearnStorageV1 = {
        ...current,
        lessons: {
          ...current.lessons,
          [slug]: { ...existing, ...partial, updatedAt: new Date().toISOString() },
        },
      }
      writeStorage(next)
      return next
    })
  }, [])

  const setLastVisited = useCallback((slug: string) => {
    setStorage(() => {
      // Always read fresh from localStorage to avoid race conditions
      const current = readStorage()
      const next: LearnStorageV1 = { ...current, lastVisitedLesson: slug }
      writeStorage(next)
      return next
    })
  }, [])

  return { storage, updateLesson, setLastVisited }
}
