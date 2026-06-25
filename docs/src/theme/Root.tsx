import type { ReactNode } from 'react'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import { DocsChatProvider } from '@mastra/docusaurus-plugin-kapa/client'
import { PostHogProvider } from 'posthog-js/react'
import { CookieConsent } from '@site/src/components/cookie/cookie-consent'

function KapaWrapper({ children }: { children: ReactNode }) {
	return <DocsChatProvider>{children}</DocsChatProvider>
}

export default function Root({ children }: { children: ReactNode }) {
	const { siteConfig } = useDocusaurusContext()
	const posthogApiKey = siteConfig.customFields?.posthogApiKey as string
	const posthogHost = (siteConfig.customFields?.posthogHost as string) || 'https://us.i.posthog.com'

	return (
		<PostHogProvider
			apiKey={posthogApiKey}
			options={{
				api_host: posthogHost,
			}}
		>
			<CookieConsent />
			<KapaWrapper>{children}</KapaWrapper>
		</PostHogProvider>
	)
}
