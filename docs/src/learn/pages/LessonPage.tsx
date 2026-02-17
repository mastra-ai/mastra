import { useEffect, useState, lazy, Suspense, useMemo } from 'react'
import { useLocation } from '@docusaurus/router'
import Head from '@docusaurus/Head'
import { course } from '../course'
import { useLessonProgress } from '../hooks/useLessonProgress'
import { contentModules } from '../contentIndex'
import { LearnLayout } from '../components/LearnLayout'
import { LessonHeader } from '../components/LessonHeader'
import { LessonNav } from '../components/LessonNav'
import { YouTubePlayerWithResume } from '../components/YouTubePlayerWithResume'
import { WatchedCheckbox } from '../components/WatchedCheckbox'
import { CourseSignupCTA } from '../components/CourseSignupCTA'
import { getLessonIndex } from '../utils'

function LearnNotFound() {
  return (
    <LearnLayout title="Lesson Not Found | Mastra Learn">
      <div className="py-20 text-center">
        <h1 className="text-3xl font-bold text-(--mastra-text-primary)">Lesson not found</h1>
        <p className="mt-2 text-(--mastra-text-tertiary)">
          The lesson you're looking for doesn't exist.{' '}
          <a href="/learn" className="text-(--mastra-green-accent-2) hover:underline">
            Back to course overview
          </a>
        </p>
      </div>
    </LearnLayout>
  )
}

function ComingSoonContent({ lesson }: { lesson: (typeof course.lessons)[number] }) {
  return (
    <div className="mt-6">
      <div className="rounded-lg border border-(--border) bg-(--mastra-surface-1) p-6 dark:bg-(--mastra-surface-2)">
        <p className="text-(--mastra-text-secondary)">{lesson.preview.intro}</p>
        <h3 className="mt-4 mb-2 text-sm font-semibold text-(--mastra-text-primary)">What you'll learn:</h3>
        <ul className="m-0 list-none space-y-2 p-0">
          {lesson.preview.bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-(--mastra-text-secondary)">
              <span className="mt-1 text-green-500">•</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
      <CourseSignupCTA className="mt-8" />
    </div>
  )
}

function PublishedContent({ lesson }: { lesson: (typeof course.lessons)[number] }) {
  const { watched, seconds, setWatched, setSeconds, setLastVisited } = useLessonProgress(lesson.slug)

  useEffect(() => {
    setLastVisited(lesson.slug)
  }, [lesson.slug, setLastVisited])

  const MdxContent = useMemo(() => {
    const loader = contentModules[lesson.slug]
    if (!loader) return null
    return lazy(loader)
  }, [lesson.slug])

  return (
    <>
      {lesson.youtubeId && (
        <YouTubePlayerWithResume
          videoId={lesson.youtubeId}
          savedSeconds={seconds}
          onTimeUpdate={setSeconds}
          onAutoComplete={() => setWatched(true)}
        />
      )}
      <WatchedCheckbox checked={watched} onChange={setWatched} />
      {MdxContent && (
        <div className="learn-mdx-content mt-6">
          <Suspense fallback={<div className="py-4 text-(--mastra-text-tertiary)">Loading content...</div>}>
            <MdxContent />
          </Suspense>
        </div>
      )}
      <CourseSignupCTA className="mt-8" />
    </>
  )
}

export default function LessonPage() {
  const location = useLocation()
  const slug = location.pathname.replace(/^\/learn\//, '').replace(/\/$/, '')
  const lessonIndex = getLessonIndex(course.lessons, slug)

  if (lessonIndex === -1) {
    return <LearnNotFound />
  }

  const lesson = course.lessons[lessonIndex]
  const prev = lessonIndex > 0 ? course.lessons[lessonIndex - 1] : undefined
  const next = lessonIndex < course.lessons.length - 1 ? course.lessons[lessonIndex + 1] : undefined

  const seoTitle = lesson.seo?.title ?? `${lesson.title} | Mastra Learn`
  const seoDescription = lesson.seo?.description ?? lesson.preview.intro

  return (
    <LearnLayout title={seoTitle} description={seoDescription}>
      <Head>
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
      </Head>

      <LessonHeader lesson={lesson} lessonNumber={lessonIndex + 1} totalLessons={course.lessons.length} />

      {lesson.status === 'published' ? <PublishedContent lesson={lesson} /> : <ComingSoonContent lesson={lesson} />}

      <LessonNav prev={prev} next={next} className="mt-8 border-t border-t-(--border)" />
    </LearnLayout>
  )
}
