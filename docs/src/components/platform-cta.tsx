import { useLocation } from '@docusaurus/router'
import { ArrowUpRight, Cloud } from 'lucide-react'

import { Button } from './ui/button'
import { Card } from './ui/card'

const signupUrl = 'https://projects.mastra.ai/sign-up'

export default function PlatformCta({ placement }: { placement: 'header' | 'card' }) {
  const { pathname } = useLocation()

  if (!/^\/(?:ja\/)?docs(?:\/|$)/.test(pathname)) return null

  if (placement === 'header') {
    return (
      <Button
        asChild
        size="sm"
        weight="medium"
        className="h-8 shrink-0 rounded-full border border-(--border) bg-(--mastra-surface-2) px-2 text-(--mastra-text-primary)! no-underline! hover:bg-(--mastra-surface-3) sm:px-3 dark:bg-(--mastra-surface-4)"
      >
        <a href={signupUrl} data-llms-ignore>
          <span className="lg:hidden">Sign up</span>
          <span className="hidden lg:inline">Deploy agents</span>
        </a>
      </Button>
    )
  }

  return (
    <aside aria-label="Mastra Platform" data-llms-ignore className="@container">
      <Card className="gap-4 rounded-xl border border-(--border) bg-(--mastra-surface-1)/20 p-4 shadow-none">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-(--mastra-text-primary)">
            <Cloud aria-hidden="true" className="size-4 shrink-0 text-(--mastra-text-secondary)" />
            Mastra Platform
          </div>
          <p className="mt-2! mb-0! text-sm leading-relaxed text-(--mastra-text-tertiary)">
            Managed hosting for your agents and a shared workspace for your team.
          </p>
        </div>
        <Button
          asChild
          weight="medium"
          className="h-10 w-full shrink-0 justify-between rounded-xl border border-(--border) bg-(--mastra-surface-2) text-(--mastra-text-primary)! no-underline! hover:bg-(--mastra-surface-3) dark:bg-(--mastra-surface-4)"
        >
          <a href={signupUrl}>
            <span className="hidden @max-[13rem]:inline">Sign up</span>
            <span className="@max-[13rem]:hidden">Deploy your agents</span>
            <ArrowUpRight aria-hidden="true" className="@max-[13rem]:hidden" />
          </a>
        </Button>
      </Card>
    </aside>
  )
}
