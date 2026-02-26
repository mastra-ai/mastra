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

// ─── Tab switcher tests (desktop only — tabs are hidden on mobile via lg:block) ──

test.describe('Tab switcher navigation', () => {
  test('desktop: clicking tabs navigates between sections', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Tab switcher is hidden on mobile (hidden lg:block)')

    const getErrors = trackJsErrors(page)

    await page.goto('/docs', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')

    // The tab bar with aria-label="Documentation tabs"
    const tabBar = page.locator('[aria-label="Documentation tabs"]')
    await expect(tabBar).toBeVisible()

    // Verify Docs tab is active initially
    const docsTab = tabBar.locator('a', { hasText: 'Docs' }).first()
    await expect(docsTab).toHaveAttribute('data-active', 'true')

    // Click through remaining tabs
    const tabs = [
      { label: 'Models', expectedPath: '/models' },
      { label: 'Guides', expectedPath: '/guides' },
      { label: 'Reference', expectedPath: '/reference' },
    ]

    for (const tab of tabs) {
      const tabLink = tabBar.locator('a', { hasText: tab.label }).first()
      await tabLink.click()
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(new RegExp(tab.expectedPath))
      await expect(tabLink).toHaveAttribute('data-active', 'true')
    }

    expect(getErrors(), 'JS errors during tab navigation').toEqual([])
  })
})

// ─── Mobile docs dropdown tests (mobile only — dropdown is in hamburger menu) ──

test.describe('Mobile docs dropdown', () => {
  test('mobile: switching sections via dropdown in hamburger menu', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile docs dropdown only renders in mobile sidebar')

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

    // The MobileDocsDropdown should be visible — it's a button showing the active section
    const dropdown = mobileSidebar.locator('button', { hasText: 'Docs' }).first()
    await expect(dropdown).toBeVisible()

    // Click the dropdown to open it
    await dropdown.click()

    // Wait for Radix dropdown content to appear
    const dropdownContent = page.locator('[data-slot="dropdown-menu-content"]')
    await expect(dropdownContent).toBeVisible({ timeout: 5000 })

    // Click "Models" in the dropdown menu
    const modelsItem = dropdownContent.locator('a', { hasText: 'Models' }).first()
    await modelsItem.click()
    await page.waitForLoadState('networkidle')

    // Should have navigated to /models
    await expect(page).toHaveURL(/\/models/)

    expect(getErrors(), 'JS errors during mobile docs dropdown navigation').toEqual([])
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
    const sidebarLinks = sidebar.locator('a.menu__link:not(.menu__link--active)[href*="/docs/"]')
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

    // Find a navigation link in the mobile sidebar
    const mobileLink = mobileSidebar.locator('a.menu__link').first()
    const href = await mobileLink.getAttribute('href')
    expect(href).toBeTruthy()

    await mobileLink.click()
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
    const allAdmonitions = page.locator('[data-testid="admonition-title"]')
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
    const visibleAdmonitions = page.locator('[data-testid="admonition-title"]:visible')
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

    await secondTab.click()

    // After clicking, second tab should be active, first should not
    await expect(secondTab).toHaveAttribute('aria-selected', 'true')
    await expect(secondTab).toHaveClass(/tabs__item--active/)
    await expect(firstTab).toHaveAttribute('aria-selected', 'false')
    await expect(firstTab).not.toHaveClass(/tabs__item--active/)

    // Click the third tab
    const thirdTab = tabs.nth(2)
    await thirdTab.click()
    await expect(thirdTab).toHaveAttribute('aria-selected', 'true')
    await expect(thirdTab).toHaveClass(/tabs__item--active/)
    await expect(secondTab).toHaveAttribute('aria-selected', 'false')

    // Click back to first tab
    await firstTab.click()
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
    await tabs.nth(1).click()
    await expect(panels.nth(0)).toBeHidden()
    await expect(panels.nth(1)).toBeVisible()
    await expect(panels.nth(2)).toBeHidden()

    // Click the third tab
    await tabs.nth(2).click()
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

    // Chatbot sidebar starts in collapsed state
    const expandTrigger = page.locator('[aria-label="Expand chatbot"]')
    await expect(expandTrigger).toBeVisible({ timeout: 10_000 })

    // The "Chat with Mastra docs" header should NOT be visible yet
    await expect(page.getByText('Chat with Mastra docs')).not.toBeVisible()

    // Click to expand the chatbot
    await expandTrigger.click()

    // Verify chatbot opened: header and the chat textarea should be visible
    await expect(page.getByText('Chat with Mastra docs')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('textarea[placeholder*="Ask questions about Mastra"]')).toBeVisible()

    // Close the chatbot
    const collapseButton = page.locator('[aria-label="Collapse chatbot"]')
    await expect(collapseButton).toBeVisible()
    await collapseButton.click()

    // Verify chatbot closed
    await expect(page.getByText('Chat with Mastra docs')).not.toBeVisible({ timeout: 5000 })
    await expect(expandTrigger).toBeVisible()

    expect(getErrors(), 'JS errors during chatbot interaction').toEqual([])
  })
})
