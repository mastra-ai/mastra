import { useMemo } from 'react'
import Head from '@docusaurus/Head'
import { course } from '../course'
import type { Lesson } from '../types'
import { useSharedLearnStorage } from '../hooks/LearnStorageContext'
import { LearnLayout } from '../components/LearnLayout'

import { LessonListItem } from '../components/LessonListItem'
import { CourseSignupCTA } from '../components/CourseSignupCTA'

function useModules(lessons: Lesson[]) {
  return useMemo(() => {
    const map = new Map<string, { lesson: Lesson; globalIndex: number }[]>()
    for (let i = 0; i < lessons.length; i++) {
      const lesson = lessons[i]
      const group = map.get(lesson.module) ?? []
      group.push({ lesson, globalIndex: i })
      map.set(lesson.module, group)
    }
    return Array.from(map.entries())
  }, [lessons])
}

function LandingContent() {
  const { storage } = useSharedLearnStorage()
  const modules = useModules(course.lessons)

  return (
    <>
      <Head>
        <meta property="og:title" content="Learn | Mastra" />
        <meta property="og:description" content={course.description} />
      </Head>

      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-(--mastra-text-primary)">{course.title}</h1>
        {course.description.split('\n\n').map((para, i) => (
          <p key={i} className="mt-2 text-(--mastra-text-tertiary)">
            {para}
          </p>
        ))}
      </div>

      {/* Lesson list grouped by module */}
      <div className="flex flex-col gap-8">
        {modules.map(([moduleName, moduleLessons]) => (
          <div key={moduleName}>
            <h3 className="mb-3 text-sm font-semibold text-(--mastra-text-tertiary)">{moduleName}</h3>
            <div className="flex flex-col gap-2">
              {moduleLessons.map(({ lesson, globalIndex }) => (
                <LessonListItem key={lesson.slug} lesson={lesson} index={globalIndex} storage={storage} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer CTA */}
      <CourseSignupCTA className="mt-10" />
    </>
  )
}

export default function LearnLandingPage() {
  return (
    <LearnLayout title="Learn | Mastra" description={course.description}>
      <LandingContent />
    </LearnLayout>
  )
}
