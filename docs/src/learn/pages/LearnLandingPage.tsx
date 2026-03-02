import { useMemo } from 'react'
import Head from '@docusaurus/Head'
import Link from '@docusaurus/Link'
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
        <meta property="og:title" content={`${course.title} - Free Full Course`} />
        <meta property="og:description" content={course.description} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://mastra.ai/img/guil-hernandez.jpg" />
        <meta name="author" content="Guil Hernandez" />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Course',
            name: course.title,
            description: course.description,
            provider: {
              '@type': 'Organization',
              name: 'Mastra',
              url: 'https://mastra.ai',
            },
            instructor: {
              '@type': 'Person',
              name: 'Guil Hernandez',
              url: 'https://www.linkedin.com/in/guiljh/',
              image: 'https://mastra.ai/img/guil-hernandez.jpg',
              jobTitle: 'Developer Educator',
              description: 'Over a decade building and teaching software, with courses used by 500,000+ learners.',
            },
            isAccessibleForFree: true,
            hasCourseInstance: {
              '@type': 'CourseInstance',
              courseMode: 'online',
              courseWorkload: 'PT90M',
            },
          })}
        </script>
      </Head>

      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-(--mastra-text-primary)">
          {course.title.replace('AI ', '')}
        </h1>
        {course.description.split('\n\n').map((para, i) => (
          <p key={i} className="mt-2 text-(--mastra-text-tertiary)">
            {para}
          </p>
        ))}
        <p className="mt-2 text-(--mastra-text-tertiary)">
          <Link to="/learn/what-is-an-agent" className="text-[#027930] hover:underline">
            Head to the first lesson
          </Link>{' '}
          to start building with Guil.
        </p>
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
    <LearnLayout title={`${course.title} - Free Full Course`} description={course.description}>
      <LandingContent />
    </LearnLayout>
  )
}
