/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import useIsBrowser from '@docusaurus/useIsBrowser'
import { useFeatureFlagEnabled } from 'posthog-js/react'

declare global {
	interface Window {
		gtag?: (...args: any[]) => void
		dataLayer?: any[]
	}
}

export function CookieBanner({ onConsentChange }: { onConsentChange: (consent: boolean) => void }) {
	const [showBanner, setShowBanner] = useState(null)
	const isBrowser = useIsBrowser()

	// Try to use feature flag, but default to true if undefined
	// This ensures the banner works even if PostHog isn't properly initialized
	const featureFlag = useFeatureFlagEnabled('cookie-banner')
	const isInEU = featureFlag !== undefined ? featureFlag : false

	useEffect(() => {
		if (!isBrowser) return

		if (!isInEU) {
			setShowBanner(false)
			onConsentChange(true)
			window.gtag?.('consent', 'update', {
				analytics_storage: 'granted',
				ad_storage: 'granted',
				ad_user_data: 'granted',
				ad_personalization: 'granted',
			})
			return
		}

		const existingConsent = localStorage.getItem('cookie-consent')
		if (existingConsent === 'true') {
			setShowBanner(false)
			onConsentChange(true)
			window.gtag?.('consent', 'update', {
				analytics_storage: 'granted',
				ad_storage: 'granted',
				ad_user_data: 'granted',
				ad_personalization: 'granted',
			})
		} else if (existingConsent === 'false') {
			setShowBanner(false)
			onConsentChange(false)
			window.gtag?.('consent', 'update', {
				analytics_storage: 'denied',
				ad_storage: 'denied',
				ad_user_data: 'denied',
				ad_personalization: 'denied',
			})
		} else {
			setShowBanner(true)
		}
	}, [isInEU, isBrowser])

	const handleAccept = () => {
		localStorage.setItem('cookie-consent', 'true')
		onConsentChange(true)
		window.gtag?.('consent', 'update', {
			analytics_storage: 'granted',
			ad_storage: 'granted',
			ad_user_data: 'granted',
			ad_personalization: 'granted',
		})
		setShowBanner(false)
	}

	const handleReject = () => {
		localStorage.setItem('cookie-consent', 'false')
		onConsentChange(false)
		window.gtag?.('consent', 'update', {
			analytics_storage: 'denied',
			ad_storage: 'denied',
			ad_user_data: 'denied',
			ad_personalization: 'denied',
		})
		setShowBanner(false)
	}

	if (showBanner === null) return null
	if (showBanner === false) return null

	return (
		<div className="fixed right-20 bottom-8 z-50 flex w-80.5 items-center justify-center rounded-xl bg-white p-4 shadow-[0_4px_24px_rgba(0,0,0,.1)] dark:border dark:border-neutral-700 dark:bg-black">
			<div>
				<p className="mb-4 font-sans text-sm dark:text-white">
					We use tracking cookies to understand how you use the product and help us improve it. Please accept cookies to
					help us improve.
				</p>
				<button
					type="button"
					onClick={handleAccept}
					className="inline-flex h-6 cursor-pointer items-center justify-center gap-2 rounded-md border-[0.5px] border-[#393939] bg-black pl-[0.38rem] pr-[0.44rem] font-sans text-xs font-normal whitespace-nowrap text-white transition-colors hover:bg-secondary/80 focus-visible:border-(--mastra-green-accent-2) focus-visible:ring-2 focus-visible:ring-(--mastra-green-accent-2)/20 focus-visible:outline-none dark:bg-white dark:text-black"
				>
					Accept cookies
				</button>
				<span> </span>
				<button
					type="button"
					onClick={handleReject}
					className="inline-flex h-6 cursor-pointer items-center justify-center gap-2 rounded-md border-[0.5px] border-[#393939] bg-[rgba(255,255,255,0.06)] pl-[0.38rem] pr-[0.44rem] font-sans text-xs font-normal whitespace-nowrap text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:border-(--mastra-green-accent-2) focus-visible:ring-2 focus-visible:ring-(--mastra-green-accent-2)/20 focus-visible:outline-none dark:text-white"
				>
					Decline cookies
				</button>
			</div>
		</div>
	)
}
