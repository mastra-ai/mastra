export type LessonStatus = 'published' | 'comingSoon'

export type Lesson = {
  slug: string
  title: string
  durationMin: number
  status: LessonStatus
  youtubeId?: string
  preview: { intro: string; bullets: string[] }
  contentPath?: string
  module: string
  seo?: { title?: string; description?: string }
}

export type Course = {
  courseId: string
  title: string
  description: string
  lessons: Lesson[]
}

export type LessonProgress = {
  watched: boolean
  seconds: number
  updatedAt: string
}

export type LearnStorageV1 = {
  lastVisitedLesson: string | null
  lessons: Record<string, LessonProgress>
}
