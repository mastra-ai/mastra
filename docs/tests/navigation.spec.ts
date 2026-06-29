import { test, expect, type Page } from '@playwright/test'

const IGNORED_ERROR_PATTERNS = [
	/hydrat/i,
	/Minified React error/i,
	/React does not recognize/i,
	/Cannot update a component/i,
	/Warning:/,
	/DEV_ONLY/,
	/PostHog/i,
	/posthog/i,
	/algolia/i,
	/kapa/i,
	/hubspot|hs-scripts/i,
	/reo\.dev/i,
	/google.*tag|gtag|gtm/i,
	// Vercel analytics & speed insights (not available locally)
	/_vercel\/(insights|speed-insights)/,
	/chrome-extension/i,
	/service-worker/i,
	/ResizeObserver loop/i,
	/Content Security Policy/i,
	// Browser's generic "Failed to load resource" message (no URL context) —
	// third-party scripts (Vercel analytics, HubSpot, etc.) fail locally.
	// Real broken resources are caught by network-level checks in smoke tests.
	/^Failed to load resource/i,
]

function shouldIgnore(msg: string): boolean {
	return IGNORED_ERROR_PATTERNS.some(p => p.test(msg))
}

/** Attach JS error tracking to a page, returns a getter for collected errors. */
function trackJsErrors(p: Page): () => string[] {
	const errors: string[] = []
	p.on('pageerror', error => {
		const msg = error.message || error.toString()
		if (!shouldIgnore(msg)) errors.push(msg)
	})
	p.on('console', msg => {
		if (msg.type() === 'error') {
			const text = msg.text()
			if (!shouldIgnore(text)) errors.push(text)
		}
	})
	return () => errors
}

// ─── Primary navbar tests ──────────────────────────────────────────────

test.describe('Primary navbar navigation', () => {
	test('desktop: clicking navbar section links navigates between sections', async ({ page, isMobile }) => {
		test.skip(isMobile, 'Desktop navbar links collapse into the hamburger menu on mobile')

		const getErrors = trackJsErrors(page)

		await page.goto('/docs', { waitUntil: 'domcontentloaded' })
		await page.waitForLoadState('networkidle')

		const navbar = page.getByRole('navigation', { name: 'Main' })
		await expect(navbar).toBeVisible()
		await expect(navbar.getByRole('link', { name: 'Docs' })).toBeVisible()

		const sections = [
			{ label: 'Models', expectedPath: /\/models\/?$/ },
			{ label: 'Guides', expectedPath: /\/guides\/?$/ },
			{ label: 'Reference', expectedPath: /\/reference\/?$/ },
		]

		for (const section of sections) {
			await navbar.getByRole('link', { name: section.label }).click()
			await page.waitForLoadState('networkidle')
			await expect(page).toHaveURL(section.expectedPath)
		}

		expect(getErrors(), 'JS errors during navbar navigation').toEqual([])
	})
})

// ─── Mobile navbar tests ───────────────────────────────────────────────

test.describe('Mobile navbar navigation', () => {
	test('mobile: switching sections via hamburger menu links', async ({ page, isMobile }) => {
		test.skip(!isMobile, 'Mobile navbar links render in the hamburger menu')

		const getErrors = trackJsErrors(page)

		await page.goto('/docs', { waitUntil: 'domcontentloaded' })
		await page.waitForLoadState('networkidle')

		const hamburger = page.locator('[aria-label="Toggle navigation bar"]')
		await expect(hamburger).toBeVisible()
		await hamburger.click()

		const mobileSidebar = page.locator('.navbar-sidebar')
		await expect(mobileSidebar).toBeVisible()

		const modelsLink = mobileSidebar.getByRole('link', { name: 'Models' })
		await expect(modelsLink).toBeVisible()
		await modelsLink.evaluate((link: HTMLAnchorElement) => link.click())
		await page.waitForLoadState('networkidle')
		await expect(page).toHaveURL(/\/models\/?$/)

		expect(getErrors(), 'JS errors during mobile navbar navigation').toEqual([])
	})
})

// ─── Sidebar navigation tests ──────────────────────────────────────────

test.describe('Sidebar navigation', () => {
	test('desktop: sidebar is visible and links work', async ({ page, isMobile }) => {
		test.skip(isMobile, 'Desktop sidebar not rendered on mobile')

		const getErrors = trackJsErrors(page)

		await page.goto('/docs', { waitUntil: 'domcontentloaded' })
		await page.waitForLoadState('networkidle')

		// Verify sidebar is visible
		const sidebar = page.locator('.theme-doc-sidebar-container')
		await expect(sidebar).toBeVisible()

		// Find and click a sidebar link that has a real path (not just # or empty)
		// Exclude --sublist links: those are collapsible category headers that preventDefault on click
		const sidebarLinks = sidebar.locator(
			'a.menu__link:not(.menu__link--active):not(.menu__link--sublist)[href*="/docs/"]',
		)
		const firstLink = sidebarLinks.first()
		const href = await firstLink.getAttribute('href')
		expect(href).toBeTruthy()

		await firstLink.click()
		await page.waitForLoadState('networkidle')

		// Verify navigation happened
		await expect(page).toHaveURL(new RegExp(href!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))

		expect(getErrors(), 'JS errors during sidebar navigation').toEqual([])
	})

	test('mobile: hamburger menu opens and sidebar links work', async ({ page, isMobile }) => {
		test.skip(!isMobile, 'Mobile sidebar only renders on mobile')

		const getErrors = trackJsErrors(page)

		await page.goto('/docs', { waitUntil: 'domcontentloaded' })
		await page.waitForLoadState('networkidle')

		// Open hamburger menu
		const hamburger = page.locator('[aria-label="Toggle navigation bar"]')
		await expect(hamburger).toBeVisible()
		await hamburger.click()

		// Mobile sidebar should appear
		const mobileSidebar = page.locator('.navbar-sidebar')
		await expect(mobileSidebar).toBeVisible()

		// Click a specific non-active docs sidebar link.
		const mobileLink = mobileSidebar.getByRole('link', { name: 'Project Structure' })
		await expect(mobileLink).toBeVisible()
		const href = await mobileLink.getAttribute('href')
		expect(href).toBeTruthy()

		await mobileLink.evaluate((link: HTMLAnchorElement) => link.click())
		await page.waitForLoadState('networkidle')

		// Verify navigation happened
		await expect(page).toHaveURL(new RegExp(href!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))

		// Mobile sidebar should close after navigation
		await expect(mobileSidebar).not.toBeVisible({ timeout: 5000 })

		expect(getErrors(), 'JS errors during mobile sidebar navigation').toEqual([])
	})
})

// ─── Admonitions and tabs on /guides/build-your-ui/ai-sdk-ui ──────────

test.describe('Admonitions and tabs on AI SDK UI guide', () => {
	const PAGE = '/guides/build-your-ui/ai-sdk-ui'

	test('admonitions are rendered and visible', async ({ page }) => {
		const getErrors = trackJsErrors(page)

		await page.goto(PAGE, { waitUntil: 'domcontentloaded' })
		await page.waitForLoadState('networkidle')

		// The page has admonitions of types: note, tip, info, warning.
		// Some admonitions are inside inactive tab panels (hidden attribute),
		// so we check all titles in the DOM for type coverage, then verify
		// only the visible ones are properly rendered.
		const allAdmonitions = page.locator('[data-mid="admonition-title"]')
		const totalCount = await allAdmonitions.count()
		expect(totalCount, 'Expected at least 4 admonitions on the page').toBeGreaterThanOrEqual(4)

		const titles: string[] = []
		for (let i = 0; i < totalCount; i++) {
			titles.push((await allAdmonitions.nth(i).textContent())?.toLowerCase() ?? '')
		}

		for (const type of ['note', 'tip', 'info', 'warning']) {
			expect(
				titles.some(t => t.includes(type)),
				`Expected an admonition of type "${type}"`,
			).toBe(true)
		}

		// Use Playwright's :visible pseudo-selector to only check admonitions
		// that are not inside hidden tab panels
		const visibleAdmonitions = page.locator('[data-mid="admonition-title"]:visible')
		const visibleCount = await visibleAdmonitions.count()
		expect(visibleCount, 'Expected at least 3 visible admonitions').toBeGreaterThanOrEqual(3)

		expect(getErrors(), 'JS errors while checking admonitions').toEqual([])
	})

	test('tabs render, switch content, and show the correct panel', async ({ page }) => {
		const getErrors = trackJsErrors(page)

		await page.goto(PAGE, { waitUntil: 'domcontentloaded' })
		await page.waitForLoadState('networkidle')

		// All tab containers on the page
		const tabContainers = page.locator('.tabs-container')
		const containerCount = await tabContainers.count()
		expect(containerCount, 'Expected multiple tab groups').toBeGreaterThanOrEqual(2)

		// Test the chatRoute/workflowRoute/networkRoute tab group (second .tabs-container)
		const tabGroup = tabContainers.nth(1)
		await tabGroup.scrollIntoViewIfNeeded()

		const tabs = tabGroup.locator('[role="tab"]')
		const tabCount = await tabs.count()
		expect(tabCount, 'Tab group should have 3 tabs').toBe(3)

		// Verify tab labels
		await expect(tabs.nth(0)).toContainText('chatRoute()')
		await expect(tabs.nth(1)).toContainText('workflowRoute()')
		await expect(tabs.nth(2)).toContainText('networkRoute()')

		// First tab should be active by default
		const firstTab = tabs.first()
		await expect(firstTab).toHaveAttribute('aria-selected', 'true')
		await expect(firstTab).toHaveClass(/tabs__item--active/)

		// Click the second tab
		const secondTab = tabs.nth(1)
		await expect(secondTab).toHaveAttribute('aria-selected', 'false')

		await secondTab.evaluate((tab: HTMLElement) => tab.click())

		// After clicking, second tab should be active, first should not
		await expect(secondTab).toHaveAttribute('aria-selected', 'true')
		await expect(secondTab).toHaveClass(/tabs__item--active/)
		await expect(firstTab).toHaveAttribute('aria-selected', 'false')
		await expect(firstTab).not.toHaveClass(/tabs__item--active/)

		// Click the third tab
		const thirdTab = tabs.nth(2)
		await thirdTab.evaluate((tab: HTMLElement) => tab.click())
		await expect(thirdTab).toHaveAttribute('aria-selected', 'true')
		await expect(thirdTab).toHaveClass(/tabs__item--active/)
		await expect(secondTab).toHaveAttribute('aria-selected', 'false')

		// Click back to first tab
		await firstTab.evaluate((tab: HTMLElement) => tab.click())
		await expect(firstTab).toHaveAttribute('aria-selected', 'true')
		await expect(firstTab).toHaveClass(/tabs__item--active/)
		await expect(thirdTab).toHaveAttribute('aria-selected', 'false')

		expect(getErrors(), 'JS errors while interacting with tabs').toEqual([])
	})

	test('tab panels toggle visibility when switching tabs', async ({ page }) => {
		const getErrors = trackJsErrors(page)

		await page.goto(PAGE, { waitUntil: 'domcontentloaded' })
		await page.waitForLoadState('networkidle')

		// Use the chatRoute/workflowRoute/networkRoute tab group (second .tabs-container)
		// In Docusaurus, the tab panels are INSIDE the tabs-container:
		//   div.tabs-container > ul[role=tablist] + div.margin-top--md > div[role=tabpanel]*
		const tabGroup = page.locator('.tabs-container').nth(1)
		await tabGroup.scrollIntoViewIfNeeded()

		const tabs = tabGroup.locator('[role="tab"]')
		const panels = tabGroup.locator('[role="tabpanel"]')
		const panelCount = await panels.count()
		expect(panelCount, 'Expected 3 tab panels (chatRoute, workflowRoute, networkRoute)').toBe(3)

		// With the first tab selected, first panel should be visible, others hidden
		await expect(panels.nth(0)).toBeVisible()
		await expect(panels.nth(1)).toBeHidden()
		await expect(panels.nth(2)).toBeHidden()

		// Click the second tab
		await tabs.nth(1).evaluate((tab: HTMLElement) => tab.click())
		await expect(panels.nth(0)).toBeHidden()
		await expect(panels.nth(1)).toBeVisible()
		await expect(panels.nth(2)).toBeHidden()

		// Click the third tab
		await tabs.nth(2).evaluate((tab: HTMLElement) => tab.click())
		await expect(panels.nth(0)).toBeHidden()
		await expect(panels.nth(1)).toBeHidden()
		await expect(panels.nth(2)).toBeVisible()

		expect(getErrors(), 'JS errors while switching tab panels').toEqual([])
	})
})

// ─── Chatbot sidebar tests (desktop only — hidden below 62.25rem via CSS) ──

test.describe('Chatbot sidebar', () => {
	test('opens and closes on desktop', async ({ page, isMobile }) => {
		test.skip(isMobile, 'Chatbot sidebar is not visible on mobile')

		const getErrors = trackJsErrors(page)

		await page.goto('/docs', { waitUntil: 'domcontentloaded' })
		await page.waitForLoadState('networkidle')

		// Chat panel starts in collapsed state
		const openButton = page.getByRole('button', { name: 'Ask AI' })
		await expect(openButton).toBeVisible({ timeout: 10_000 })

		const chatPanel = page.locator('#docs-chat-panel')
		await expect(chatPanel).toHaveAttribute('aria-hidden', 'true')

		// Click to open the chat panel
		await openButton.click()

		// Verify chat opened: title and textarea should be visible
		await expect(chatPanel).toHaveAttribute('aria-hidden', 'false', { timeout: 5000 })
		await expect(chatPanel.getByText('Ask AI')).toBeVisible()
		await expect(page.locator('textarea[placeholder*="Ask me a question about Mastra"]')).toBeVisible()

		// Close the chat panel
		const closeButton = chatPanel.getByRole('button', { name: 'Hide AI chat' })
		await expect(closeButton).toBeVisible()
		await closeButton.click()

		// Verify chat closed
		await expect(chatPanel).toHaveAttribute('aria-hidden', 'true', { timeout: 5000 })
		await expect(openButton).toBeVisible()

		expect(getErrors(), 'JS errors during chatbot interaction').toEqual([])
	})
})
