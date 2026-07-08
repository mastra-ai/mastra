import { Button } from '@site/src/components/ui/button'
import { useDocsChat } from '@mastra/docusaurus-plugin-kapa/client'
import type { Ref } from 'react'

export function AskAI() {
  const { toggle, triggerRef } = useDocsChat()

  return (
    <Button
      ref={triggerRef as Ref<HTMLButtonElement>}
      onClick={toggle}
      size="sm"
      variant="outline"
      className="rounded-lg border-[0.5px] border-(--border) text-(--mastra-text-secondary) shadow-none hover:bg-(--mastra-surface-2) hover:text-(--mastra-text-primary) dark:bg-(--mastra-surface-4)"
    >
      <span className="text-sm">Ask AI</span>
    </Button>
  )
}
