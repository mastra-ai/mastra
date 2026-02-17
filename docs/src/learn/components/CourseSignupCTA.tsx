import { useState, useEffect } from 'react'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import { cn } from '@site/src/lib/utils'
import { Button } from '@site/src/components/ui/button'
import { Input } from '@site/src/components/ui/input'

const SUBSCRIBED_KEY = 'mastraLearn:subscribed'

type CourseSignupCTAProps = {
  variant?: 'full' | 'compact'
  className?: string
}

export function CourseSignupCTA({ variant = 'full', className }: CourseSignupCTAProps) {
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
    const formGuid = siteConfig.customFields?.hsFormGuid as string

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

  if (submitted && variant === 'compact') {
    return (
      <div className={cn('rounded-lg border border-(--border) p-4 text-center', className)}>
        <p className="text-sm text-(--mastra-text-tertiary)">
          You're subscribed — we'll notify you when new lessons drop.
        </p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className={cn('rounded-lg border border-green-500/20 bg-green-500/5 p-6 text-center', className)}>
        <p className="text-lg font-medium text-(--mastra-text-primary)">You're subscribed!</p>
        <p className="mt-1 text-sm text-(--mastra-text-tertiary)">We'll email you when new lessons are published.</p>
      </div>
    )
  }

  return (
    <div className={cn('rounded-lg border border-(--border) p-6', variant === 'full' && 'text-center', className)}>
      {variant === 'full' && (
        <>
          <h3 className="text-lg font-semibold text-(--mastra-text-primary)">Get notified when new lessons drop</h3>
          <p className="mt-1 mb-4 text-sm text-(--mastra-text-tertiary)">
            Join the Mastra learning community — no spam, just new lesson notifications.
          </p>
        </>
      )}
      {variant === 'compact' && (
        <p className="mb-3 text-sm text-(--mastra-text-secondary)">Get notified when new lessons are published:</p>
      )}
      <form onSubmit={handleSubmit} className={cn('flex gap-2', variant === 'full' && 'mx-auto max-w-md')}>
        <Input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="flex-1"
        />
        <Button type="submit" disabled={submitting} size="default">
          {submitting ? 'Subscribing...' : 'Subscribe'}
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  )
}
