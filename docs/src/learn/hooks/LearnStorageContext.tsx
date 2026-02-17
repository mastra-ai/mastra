import { createContext, useContext, type ReactNode } from 'react'
import { useLearnStorage } from './useLearnStorage'
import type { LearnStorageV1, LessonProgress } from '../types'

type LearnStorageContextValue = {
  storage: LearnStorageV1
  updateLesson: (slug: string, partial: Partial<LessonProgress>) => void
  setLastVisited: (slug: string) => void
}

const LearnStorageContext = createContext<LearnStorageContextValue | null>(null)

export function LearnStorageProvider({ children }: { children: ReactNode }) {
  const value = useLearnStorage()
  return <LearnStorageContext.Provider value={value}>{children}</LearnStorageContext.Provider>
}

export function useSharedLearnStorage(): LearnStorageContextValue {
  const ctx = useContext(LearnStorageContext)
  if (!ctx) throw new Error('useSharedLearnStorage must be used within LearnStorageProvider')
  return ctx
}
