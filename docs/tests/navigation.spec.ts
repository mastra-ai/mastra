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
  // Storage Access API calls can be denied in CI without breaking docs pages.
  /requestStorageAccess: Permission denied\./i,
  // Browser feature probes can be blocked by Permissions Policy in CI.
  /Permissions policy violation: compute-pressure is not allowed in this document\./i,
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

    // Find a navigation link in the mobile sidebar (exclude category headers)
    const mobileLink = mobileSidebar.locator('a.menu__link:not(.menu__link--sublist)[href]:visible').first()
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

// ─── Contextual sidebar navigation ────────────────────────────────────

const contextualTopLevelItems = [
  'Overview',
  'Tools',
  'Skills',
  'Structured Output',
  'Agent Approval',
  'Supervisor Agents',
  'Guardrails',
  'Processors',
  'Code Mode',
  'Connections',
]

function visibleSidebarPane(page: Page, pane: 'root' | 'contextual') {
  return page.locator(`[data-sidebar-pane="${pane}"]:visible`)
}

async function openMobileSidebar(page: Page) {
  const hamburger = page.getByRole('button', { name: 'Toggle navigation bar' })
  await hamburger.click()
  await expect(page.locator('.navbar-sidebar')).toBeVisible()
}

test.describe('Contextual sidebar', () => {
  test('desktop: navigates, renders configured items, and restores root focus on Back', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop sidebar not rendered on mobile')
    const getErrors = trackJsErrors(page)

    await page.goto('/docs', { waitUntil: 'domcontentloaded' })
    const rootPane = visibleSidebarPane(page, 'root')
    const agentsLink = rootPane.getByRole('link', { name: 'Agents', exact: true })
    await expect(agentsLink).toHaveAttribute('href', '/docs/agents/overview')

    await agentsLink.click()
    await expect(page).toHaveURL('/docs/agents/overview')
    const contextualPane = visibleSidebarPane(page, 'contextual')
    await expect(contextualPane).toBeVisible()
    await expect(page).toHaveURL(new RegExp('/docs/agents/overview$'))
    const backButton = contextualPane.getByRole('button', { name: 'Back to Agents' })
    await expect(backButton).toHaveText(/←\s*Agents/)
    await expect(contextualPane.getByRole('heading', { name: 'Agents' })).toHaveCount(0)

    const topLevelLinks = contextualPane.locator(
      ':scope > ul.menu__list > li > a.menu__link, :scope > ul.menu__list > li > .menu__list-item-collapsible > a.menu__link',
    )
    const topLevelLabels = await topLevelLinks
      .locator(':scope > span[title]')
      .evaluateAll(labels => labels.map(label => label.getAttribute('title')))
    expect(topLevelLabels).toEqual(contextualTopLevelItems)
    await expect(topLevelLinks.first()).toHaveAttribute('aria-current', 'page')

    const connections = contextualPane.getByRole('button', { name: 'Connections', exact: true })
    await expect(connections).toHaveAttribute('aria-expanded', 'false')
    await connections.click()
    await expect(connections).toHaveAttribute('aria-expanded', 'true')
    await expect(contextualPane.getByRole('link', { name: 'A2A', exact: true })).toBeVisible()

    await contextualPane.getByRole('link', { name: 'Tools', exact: true }).click()
    await expect(page).toHaveURL('/docs/agents/using-tools')
    await expect(visibleSidebarPane(page, 'contextual')).toBeVisible()
    await expect(
      visibleSidebarPane(page, 'contextual').getByRole('link', { name: 'Tools', exact: true }),
    ).toHaveAttribute('aria-current', 'page')

    const urlBeforeBack = page.url()
    await backButton.focus()
    await backButton.press('Enter')
    const restoredRootPane = visibleSidebarPane(page, 'root')
    await expect(restoredRootPane).toBeVisible()
    await expect(page).toHaveURL(urlBeforeBack)
    await expect(restoredRootPane).toBeFocused()
    await expect(restoredRootPane.getByRole('button', { name: "Expand sidebar category 'Agents'" })).toHaveAttribute(
      'aria-expanded',
      'false',
    )

    await restoredRootPane.getByRole('link', { name: 'Agents', exact: true }).click()
    await expect(visibleSidebarPane(page, 'contextual')).toBeVisible()
    await page.getByRole('link', { name: 'Docs', exact: true }).first().click()
    await expect(page).toHaveURL('/docs')
    await expect(visibleSidebarPane(page, 'root')).toBeVisible()

    expect(getErrors(), 'JS errors during contextual sidebar navigation').toEqual([])
  })

  test('desktop: direct destination loads initialize context while later history remains transient', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop sidebar not rendered on mobile')

    for (const path of ['/docs/agents/overview', '/docs/agents/skills']) {
      const directResponse = await page.request.get(path)
      expect(directResponse.ok()).toBe(true)
      expect(await directResponse.text()).toMatch(/data-sidebar-pane=(?:"contextual"|contextual)/)
    }

    await page.goto('/docs', { waitUntil: 'domcontentloaded' })
    await visibleSidebarPane(page, 'root').getByRole('link', { name: 'Agents', exact: true }).click()
    await expect(visibleSidebarPane(page, 'contextual')).toBeVisible()

    await page.goBack()
    await expect(page).toHaveURL('/docs')
    await expect(visibleSidebarPane(page, 'root')).toBeVisible()
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))
    await page.goForward()
    await expect(page).toHaveURL('/docs/agents/overview')
    await expect(visibleSidebarPane(page, 'root')).toBeVisible()

    await page.reload()
    await expect(visibleSidebarPane(page, 'contextual')).toBeVisible()
    await visibleSidebarPane(page, 'contextual').getByRole('button', { name: 'Back to Agents' }).click()
    await expect(visibleSidebarPane(page, 'root')).toBeVisible()
    await expect(page).toHaveURL('/docs/agents/overview')

    await page.goto('/docs/agents/skills', { waitUntil: 'domcontentloaded' })
    await expect(visibleSidebarPane(page, 'contextual')).toBeVisible()
    await expect(
      visibleSidebarPane(page, 'contextual').getByRole('link', { name: 'Skills', exact: true }),
    ).toHaveAttribute('aria-current', 'page')
    await page.reload()
    await expect(visibleSidebarPane(page, 'contextual')).toBeVisible()
    await visibleSidebarPane(page, 'contextual').getByRole('button', { name: 'Back to Agents' }).click()
    await expect(visibleSidebarPane(page, 'root')).toBeVisible()
    await expect(page).toHaveURL('/docs/agents/skills')
  })

  test('desktop: modified click leaves the opener unchanged and the new overview tab initializes context', async ({
    page,
    context,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop sidebar not rendered on mobile')

    await page.goto('/docs', { waitUntil: 'domcontentloaded' })
    const agentsLink = visibleSidebarPane(page, 'root').getByRole('link', { name: 'Agents', exact: true })
    const newPagePromise = context.waitForEvent('page')
    await agentsLink.click({ modifiers: ['Meta'] })
    const newPage = await newPagePromise
    await newPage.waitForLoadState('domcontentloaded')

    await expect(page).toHaveURL('/docs')
    await expect(visibleSidebarPane(page, 'root')).toBeVisible()
    await expect(agentsLink.locator('xpath=ancestor::li[1]')).toHaveClass(/menu__list-item--collapsed/)
    await expect(newPage).toHaveURL('/docs/agents/overview')
    const directContextualPane = visibleSidebarPane(newPage, 'contextual')
    await expect(directContextualPane).toBeVisible()

    const childPagePromise = context.waitForEvent('page')
    await directContextualPane.getByRole('link', { name: 'Tools', exact: true }).click({ modifiers: ['Meta'] })
    const childPage = await childPagePromise
    await childPage.waitForLoadState('domcontentloaded')

    await expect(newPage).toHaveURL('/docs/agents/overview')
    await expect(visibleSidebarPane(newPage, 'contextual')).toBeVisible()
    await expect(childPage).toHaveURL('/docs/agents/using-tools')
    await expect(visibleSidebarPane(childPage, 'contextual')).toBeVisible()
  })

  test('mobile and tablet: modified click leaves the drawer and root pane unchanged', async ({
    page,
    context,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Mobile sidebar only renders on mobile and tablet')

    await page.goto('/docs', { waitUntil: 'domcontentloaded' })
    await openMobileSidebar(page)
    const agentsLink = visibleSidebarPane(page, 'root').getByRole('link', { name: 'Agents', exact: true })
    const newPagePromise = context.waitForEvent('page')
    await agentsLink.click({ modifiers: ['Meta'] })
    const newPage = await newPagePromise
    await newPage.waitForLoadState('domcontentloaded')

    await expect(page).toHaveURL('/docs')
    await expect(page.locator('.navbar-sidebar')).toBeVisible()
    await expect(visibleSidebarPane(page, 'root')).toBeVisible()
    await expect(agentsLink.locator('xpath=ancestor::li[1]')).toHaveClass(/menu__list-item--collapsed/)
    await expect(newPage).toHaveURL('/docs/agents/overview')
    await openMobileSidebar(newPage)
    const directContextualPane = visibleSidebarPane(newPage, 'contextual')
    await expect(directContextualPane).toBeVisible()

    const childPagePromise = context.waitForEvent('page')
    await directContextualPane.getByRole('link', { name: 'Tools', exact: true }).click({ modifiers: ['Meta'] })
    const childPage = await childPagePromise
    await childPage.waitForLoadState('domcontentloaded')

    await expect(newPage).toHaveURL('/docs/agents/overview')
    await expect(newPage.locator('.navbar-sidebar')).toBeVisible()
    await expect(visibleSidebarPane(newPage, 'contextual')).toBeVisible()
    await expect(childPage).toHaveURL('/docs/agents/using-tools')
    await openMobileSidebar(childPage)
    await expect(visibleSidebarPane(childPage, 'contextual')).toBeVisible()
  })

  test('mobile and tablet: drawer closes on navigation and Back swaps panes without closing', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Mobile sidebar only renders on mobile and tablet')
    const getErrors = trackJsErrors(page)

    await page.goto('/docs', { waitUntil: 'domcontentloaded' })
    await openMobileSidebar(page)
    await visibleSidebarPane(page, 'root').getByRole('link', { name: 'Agents', exact: true }).click()
    await expect(page).toHaveURL('/docs/agents/overview')
    await expect(page.locator('.navbar-sidebar')).not.toBeVisible()

    await openMobileSidebar(page)
    const contextualPane = visibleSidebarPane(page, 'contextual')
    await expect(contextualPane.getByRole('link', { name: 'Overview', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await contextualPane.getByRole('link', { name: 'Tools', exact: true }).click()
    await expect(page).toHaveURL('/docs/agents/using-tools')
    await expect(page.locator('.navbar-sidebar')).not.toBeVisible()

    await openMobileSidebar(page)
    const urlBeforeBack = page.url()
    await visibleSidebarPane(page, 'contextual').getByRole('button', { name: 'Back to Agents' }).click()
    const rootPane = visibleSidebarPane(page, 'root')
    await expect(rootPane).toBeVisible()
    await expect(page.locator('.navbar-sidebar')).toBeVisible()
    await expect(page).toHaveURL(urlBeforeBack)
    await expect(rootPane).toBeFocused()
    await expect(rootPane.getByRole('button', { name: "Expand sidebar category 'Agents'" })).toHaveAttribute(
      'aria-expanded',
      'false',
    )

    await page.goto('/docs/agents/skills', { waitUntil: 'domcontentloaded' })
    await page.reload()
    await openMobileSidebar(page)
    await expect(visibleSidebarPane(page, 'contextual')).toBeVisible()
    await expect(
      visibleSidebarPane(page, 'contextual').getByRole('link', { name: 'Skills', exact: true }),
    ).toHaveAttribute('aria-current', 'page')

    expect(getErrors(), 'JS errors during mobile contextual sidebar navigation').toEqual([])
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

// ─── AI chat sidebar tests (@mastra/docusaurus-plugin-kapa) ──
// The Kapa theme is only registered when KAPA_INTEGRATION_ID and
// KAPA_GROUP_ID are set at build time. Without them (e.g. CI) the chat UI is
// absent entirely, so the test asserts the graceful fallback instead.

test.describe('AI chat sidebar', () => {
  test('opens and closes on desktop', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Chat panel opens as a modal on mobile')

    const getErrors = trackJsErrors(page)

    await page.goto('/docs', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')

    // Desktop toggle is the navbar "Ask AI" button (the floating action
    // button is mobile-only). It renders null on Kapa-disabled builds.
    const askAI = page.getByRole('button', { name: 'Ask AI' })
    const panel = page.locator('#docs-chat-panel')

    if ((await askAI.count()) === 0) {
      // Kapa disabled build: no chat panel and no floating action button
      await expect(panel).toHaveCount(0)
      await expect(page.locator('.doc-chat-fab')).toHaveCount(0)
      expect(getErrors(), 'JS errors on Kapa-disabled build').toEqual([])
      return
    }

    // Chat panel starts hidden (desktop hides it via opacity, so assert ARIA state)
    await expect(panel).toHaveAttribute('aria-hidden', 'true', { timeout: 10_000 })

    // Open the chat via the navbar Ask AI button
    await askAI.click()
    await expect(panel).toHaveAttribute('aria-hidden', 'false', { timeout: 5000 })
    await expect(page.locator('textarea[placeholder*="Ask me a question about Mastra"]')).toBeVisible()

    // Close the chat again
    await askAI.click()
    await expect(panel).toHaveAttribute('aria-hidden', 'true', { timeout: 5000 })

    expect(getErrors(), 'JS errors during chat interaction').toEqual([])
  })
})
