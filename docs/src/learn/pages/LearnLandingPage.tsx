import Head from '@docusaurus/Head'
import { course } from '../course'
import { useLearnStorage } from '../hooks/useLearnStorage'
import { LearnLayout } from '../components/LearnLayout'
import { LearnProgressBar } from '../components/LearnProgressBar'
import { ContinueCard } from '../components/ContinueCard'
import { LessonListItem } from '../components/LessonListItem'
import { CourseSignupCTA } from '../components/CourseSignupCTA'
import { getPublishedCount } from '../utils'

export default function LearnLandingPage() {
  const { storage } = useLearnStorage()
  const publishedTotal = getPublishedCount(course.lessons)
  const watchedCount = course.lessons.filter(l => l.status === 'published' && storage.lessons[l.slug]?.watched).length

  return (
    <LearnLayout title="Learn | Mastra" description={course.description}>
      <Head>
        <meta property="og:title" content="Learn | Mastra" />
        <meta property="og:description" content={course.description} />
      </Head>

      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-(--mastra-text-primary)">{course.title}</h1>
        <p className="mt-2 text-lg text-(--mastra-text-tertiary)">{course.description}</p>
      </div>

      {/* Continue card */}
      <ContinueCard storage={storage} lessons={course.lessons} className="mb-6" />

      {/* Progress */}
      <LearnProgressBar completed={watchedCount} total={publishedTotal} className="mb-8" />

      {/* Lesson list */}
      <div className="flex flex-col gap-2">
        {course.lessons.map((lesson, i) => (
          <LessonListItem key={lesson.slug} lesson={lesson} index={i} storage={storage} />
        ))}
      </div>

      {/* Footer CTA */}
      <CourseSignupCTA variant="full" className="mt-10" />
    </LearnLayout>
  )
}
