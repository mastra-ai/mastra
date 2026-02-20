import { useState, useEffect } from 'react'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import { cn } from '@site/src/lib/utils'
import { Button } from '@site/src/components/ui/button'
import { Input } from '@site/src/components/ui/input'
import { course } from '../course'

const SUBSCRIBED_KEY = 'mastraLearn:subscribed'

type CourseSignupCTAProps = {
  className?: string
}

export function CourseSignupCTA({ className }: CourseSignupCTAProps) {
  const allPublished = course.lessons.every(l => l.status === 'published')
  const { siteConfig } = useDocusaurusContext()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (localStorage.getItem(SUBSCRIBED_KEY) === 'true') {
      setSubmitted(true)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || submitting) return

    const portalId = siteConfig.customFields?.hsPortalId as string
    const formGuid = siteConfig.customFields?.hsFormGuidLearn as string

    if (!portalId || !formGuid) {
      setError('Signup is not configured yet.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`https://api.hsforms.com/submissions/v3/integration/submit/${portalId}/${formGuid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: [{ name: 'email', value: email }],
          context: { pageName: 'Mastra Learn - Course Signup' },
        }),
      })
      if (!res.ok) throw new Error('Submission failed')
      setSubmitted(true)
      localStorage.setItem(SUBSCRIBED_KEY, 'true')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (allPublished) return null

  if (submitted) {
    return (
      <div id="learn-signup-cta" className={cn('learn-subscribed rounded-lg border p-6 text-center', className)}>
        <p className="text-lg font-medium text-(--mastra-text-primary)">You signed up!</p>
        <p className="mt-1 text-sm text-(--mastra-text-tertiary)">We'll email you when new lessons are published.</p>
      </div>
    )
  }

  return (
    <div id="learn-signup-cta" className={cn('rounded-lg border border-(--border) p-6 text-center', className)}>
      <h3 className="text-lg font-semibold text-(--mastra-text-primary)">New lessons arriving early March</h3>
      <p className="mt-1 mb-4 text-sm text-(--mastra-text-tertiary)">Get a heads-up the moment they go live.</p>
      <form onSubmit={handleSubmit} className="mx-auto flex max-w-md gap-2">
        <Input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="flex-1"
        />
        <Button type="submit" disabled={submitting} size="default">
          {submitting ? 'Signing you up...' : 'Get notified'}
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  )
}
