import type { KapaPluginOptions } from '@mastra/docusaurus-plugin-kapa'
import { Button } from '@site/src/components/ui/button'
import { usePluginData } from '@docusaurus/useGlobalData'
import { useDocsChat } from '@mastra/docusaurus-plugin-kapa/client'
import type { Ref } from 'react'

export function AskAI() {
  const pluginData = usePluginData('docusaurus-plugin-kapa', 'default', { failfast: false }) as
    | KapaPluginOptions
    | undefined
  const { toggle, triggerRef } = useDocsChat()

  // Kapa theme is not registered (e.g. CI without credentials) — no chat to open.
  if (!pluginData?.integrationId) {
    return null
  }

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
