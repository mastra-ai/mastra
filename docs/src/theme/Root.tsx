import type { KapaPluginOptions } from '@mastra/docusaurus-plugin-kapa'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import { usePluginData } from '@docusaurus/useGlobalData'
import { CookieConsent } from '@site/src/components/cookie/cookie-consent'
import { DocsChatProvider } from '@mastra/docusaurus-plugin-kapa/client'
import { KapaProvider } from '@kapaai/react-sdk'
import { PostHogProvider } from 'posthog-js/react'
import React from 'react'

/**
 * Mounts the Kapa chat provider at the app root so the conversation persists
 * across all navigation. The plugin ships it inside its per-doc-page layout,
 * where navbar navigation unmounts and resets it — hoisting it here keeps the
 * chat alive. The plugin's `DocRoot/Layout/Main` is overridden locally to drop
 * its own provider (see src/theme/DocRoot/Layout/Main). When the Kapa theme is
 * not registered (e.g. CI without credentials), there is no plugin data and the
 * provider is skipped so the build still succeeds.
 */
function KapaChatProvider({ children }: { children: React.ReactNode }) {
  const pluginData = usePluginData('docusaurus-plugin-kapa', 'default', { failfast: false }) as
    | KapaPluginOptions
    | undefined

  if (!pluginData?.integrationId) {
    return <>{children}</>
  }

  return (
    <KapaProvider
      integrationId={pluginData.integrationId}
      {...(pluginData.groupId && { sourceGroupIDsInclude: [pluginData.groupId] })}
    >
      {children}
    </KapaProvider>
  )
}

export default function Root({ children }: { children: React.ReactNode }) {
  const { siteConfig } = useDocusaurusContext()
  const posthogApiKey = siteConfig.customFields.posthogApiKey as string
  const posthogHost = (siteConfig.customFields.posthogHost as string) || 'https://us.i.posthog.com'

  return (
    <PostHogProvider
      apiKey={posthogApiKey}
      options={{
        api_host: posthogHost,
      }}
    >
      <CookieConsent />
      <DocsChatProvider>
        <KapaChatProvider>{children}</KapaChatProvider>
      </DocsChatProvider>
    </PostHogProvider>
  )
}
