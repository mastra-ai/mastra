import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import { CookieConsent } from '@site/src/components/cookie/cookie-consent'
import { DocsChatProvider, KapaChatProvider } from '@mastra/docusaurus-plugin-kapa/client'
import { PostHogProvider } from 'posthog-js/react'
import React from 'react'

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
