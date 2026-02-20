import { useState, useEffect, lazy, Suspense, useMemo } from 'react'
import { useLocation } from '@docusaurus/router'
import Head from '@docusaurus/Head'
import MDXContent from '@theme/MDXContent'
import { cn } from '@site/src/lib/utils'
import { course } from '../course'
import { useLessonProgress } from '../hooks/useLessonProgress'
import { contentModules } from '../contentIndex'
import { LearnLayout } from '../components/LearnLayout'
import { LessonHeader } from '../components/LessonHeader'
import { LessonNav } from '../components/LessonNav'
import { YouTubePlayerWithResume } from '../components/YouTubePlayerWithResume'
import { CourseSignupCTA } from '../components/CourseSignupCTA'
import { getLessonIndex } from '../utils'

function LearnNotFound() {
  return (
    <LearnLayout title="Lesson Not Found | Mastra Learn">
      <div className="py-20 text-center">
        <h1 className="text-3xl font-bold text-(--mastra-text-primary)">Lesson not found</h1>
        <p className="mt-2 text-(--mastra-text-tertiary)">
          The lesson you're looking for doesn't exist.{' '}
          <a href="/learn" className="text-(--mastra-green-accent-3) hover:underline dark:text-(--mastra-green-accent)">
            Back to course overview
          </a>
        </p>
      </div>
    </LearnLayout>
  )
}

function PublishedContent({
  lesson,
  lessonNumber,
  totalLessons,
}: {
  lesson: (typeof course.lessons)[number]
  lessonNumber: number
  totalLessons: number
}) {
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
      <LessonHeader
        lesson={lesson}
        lessonNumber={lessonNumber}
        totalLessons={totalLessons}
        watched={watched}
        onWatchedChange={setWatched}
      />
      {lesson.youtubeId && (
        <YouTubePlayerWithResume
          videoId={lesson.youtubeId}
          savedSeconds={seconds}
          onTimeUpdate={setSeconds}
          onAutoComplete={() => setWatched(true)}
        />
      )}
      {MdxContent && (
        <div className="markdown mt-6">
          <MDXContent>
            <Suspense fallback={<div className="py-4 text-(--mastra-text-tertiary)">Loading content...</div>}>
              <MdxContent />
            </Suspense>
          </MDXContent>
        </div>
      )}
      <MarkAsCompleteButton watched={watched} onToggle={() => setWatched(!watched)} className="mt-8" />
      <CourseSignupCTA className="mt-8" />
    </>
  )
}

function MarkAsCompleteButton({
  watched,
  onToggle,
  className,
}: {
  watched: boolean
  onToggle: () => void
  className?: string
}) {
  const [animating, setAnimating] = useState(false)

  return (
    <button
      type="button"
      onClick={() => {
        setAnimating(true)
        onToggle()
      }}
      className={cn(
        'flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors',
        watched
          ? 'learn-complete-button-done border-(--mastra-green-accent-3) text-(--mastra-green-accent-3) dark:border-(--mastra-green-accent-2) dark:text-(--mastra-green-accent-2)'
          : 'border-(--border) text-(--mastra-text-secondary) hover:border-(--mastra-green-accent-3) hover:text-(--mastra-text-primary)',
        className,
      )}
    >
      <span
        className={cn('learn-watched-icon', watched && 'is-watched', animating && 'is-animate')}
        onAnimationEnd={() => setAnimating(false)}
      >
        {watched && '✓'}
      </span>
      {watched ? 'Completed' : 'Mark as complete'}
    </button>
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
        {lesson.youtubeId && (
          <>
            <meta property="og:type" content="video.other" />
            <meta property="og:video" content={`https://www.youtube.com/embed/${lesson.youtubeId}`} />
            <meta property="og:image" content={`https://img.youtube.com/vi/${lesson.youtubeId}/maxresdefault.jpg`} />
            <script type="application/ld+json">
              {JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'VideoObject',
                name: lesson.title,
                description: seoDescription,
                thumbnailUrl: `https://img.youtube.com/vi/${lesson.youtubeId}/maxresdefault.jpg`,
                embedUrl: `https://www.youtube.com/embed/${lesson.youtubeId}`,
                contentUrl: `https://www.youtube.com/watch?v=${lesson.youtubeId}`,
                duration: `PT${lesson.durationMin}M`,
                publisher: {
                  '@type': 'Organization',
                  name: 'Mastra',
                  url: 'https://mastra.ai',
                },
              })}
            </script>
          </>
        )}
      </Head>

      <PublishedContent lesson={lesson} lessonNumber={lessonIndex + 1} totalLessons={course.lessons.length} />

      <LessonNav prev={prev} next={next} className="mt-8 border-t border-t-(--border)" />
    </LearnLayout>
  )
}
