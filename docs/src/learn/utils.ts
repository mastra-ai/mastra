import type { Lesson } from './types'

export function formatSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function getLessonIndex(lessons: Lesson[], slug: string): number {
  return lessons.findIndex(l => l.slug === slug)
}

export function getPublishedCount(lessons: Lesson[]): number {
  return lessons.filter(l => l.status === 'published').length
}
