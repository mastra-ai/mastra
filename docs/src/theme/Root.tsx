import { usePluginData } from '@docusaurus/useGlobalData'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import { CookieConsent } from '@site/src/components/cookie/cookie-consent'
import { mountWebMcp } from '@site/src/theme/webmcp'
import type { AlgoliaPluginData } from '@mastra/docusaurus-plugin-algolia'
import { DocsChatProvider, KapaChatProvider } from '@mastra/docusaurus-plugin-kapa/client'
import { PostHogProvider } from 'posthog-js/react'
import React, { useEffect } from 'react'

export default function Root({ children }: { children: React.ReactNode }) {
  const { siteConfig } = useDocusaurusContext()
  const posthogApiKey = siteConfig.customFields.posthogApiKey as string
  const posthogHost = (siteConfig.customFields.posthogHost as string) || 'https://us.i.posthog.com'
  const algolia = usePluginData('docusaurus-plugin-algolia', 'default') as Partial<AlgoliaPluginData> | undefined
  const { algoliaAppId, algoliaSearchApiKey, indexName, siteUrl } = algolia ?? {}

  useEffect(
    () => mountWebMcp({ appId: algoliaAppId, apiKey: algoliaSearchApiKey, indexName, siteUrl }),
    [algoliaAppId, algoliaSearchApiKey, indexName, siteUrl],
  )

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
