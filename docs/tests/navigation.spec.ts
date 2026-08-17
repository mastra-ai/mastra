import { test, expect, type Locator, type Page } from '@playwright/test'

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
      { label: 'Integrations', expectedPath: '/integrations' },
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

test.describe('Breadcrumb navigation', () => {
  test('root groups restore the global sidebar while categories link to their overviews', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/docs/connections/acp', { waitUntil: 'domcontentloaded' })

    let breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumbs' })
    const extendButton = breadcrumbs.getByRole('button', { name: 'Extend', exact: true })
    await expect(breadcrumbs.getByRole('link', { name: 'Connections', exact: true })).toHaveAttribute(
      'href',
      '/docs/connections/overview',
    )

    const connectionLink = breadcrumbs.getByRole('link', { name: 'Connections', exact: true })
    await connectionLink.hover()
    await page.waitForTimeout(250)
    const linkHover = await connectionLink.evaluate(element => {
      const style = getComputedStyle(element)
      return { backgroundColor: style.backgroundColor, color: style.color, fontWeight: style.fontWeight }
    })
    await extendButton.hover()
    await page.waitForTimeout(250)
    const buttonHover = await extendButton.evaluate(element => {
      const style = getComputedStyle(element)
      return {
        backgroundColor: style.backgroundColor,
        color: style.color,
        cursor: style.cursor,
        fontWeight: style.fontWeight,
      }
    })
    expect(buttonHover).toEqual({ ...linkHover, cursor: 'pointer' })

    await extendButton.click()
    await expect(page).toHaveURL('/docs/connections/acp')
    if (!isMobile) await expect(visibleSidebarPane(page, 'root')).toBeVisible()

    await page.goto('/docs/studio/observability', { waitUntil: 'domcontentloaded' })

    breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumbs' })
    const rootGroup = breadcrumbs.getByRole('button', { name: 'Develop / Deploy', exact: true })
    await expect(breadcrumbs.getByRole('link', { name: 'Studio', exact: true })).toHaveAttribute(
      'href',
      '/docs/studio/overview',
    )

    await rootGroup.click()
    await expect(page).toHaveURL('/docs/studio/observability')
    if (!isMobile) await expect(visibleSidebarPane(page, 'root')).toBeVisible()
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

    // Click "Integrations" in the dropdown menu
    const integrationsItem = dropdownContent.locator('a', { hasText: 'Integrations' }).first()
    await integrationsItem.click()
    await page.waitForLoadState('networkidle')

    // Should have navigated to /integrations
    await expect(page).toHaveURL(/\/integrations/)

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

  test('mobile: long sidebars use one scroll container', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile sidebar only renders on mobile')

    await page.goto('/models', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    await page.locator('[aria-label="Toggle navigation bar"]').click()

    const mobileSidebar = page.locator('.navbar-sidebar')
    await expect(mobileSidebar).toBeVisible()

    const scrollContainers = await mobileSidebar.evaluate(sidebar =>
      [sidebar, ...sidebar.querySelectorAll<HTMLElement>('*')]
        .filter(element => {
          const { overflowY } = getComputedStyle(element)
          return ['auto', 'scroll'].includes(overflowY) && element.scrollHeight > element.clientHeight
        })
        .map(element => element.className),
    )

    expect(scrollContainers).toHaveLength(1)
    expect(scrollContainers[0]).toContain('navbar-sidebar__item')
  })
})

// ─── Contextual sidebar navigation ────────────────────────────────────

function visibleSidebarPane(page: Page, pane: 'root' | 'contextual') {
  return page.locator(`[data-sidebar-pane="${pane}"]:visible`)
}

function contextualTopLevelLinks(pane: Locator) {
  return pane.locator(
    'ul[data-sidebar-panel="contextual"] > li > a.menu__link, ul[data-sidebar-panel="contextual"] > li > .menu__list-item-collapsible > a.menu__link',
  )
}

async function firstContextualChild(pane: Locator) {
  const links = contextualTopLevelLinks(pane)
  const link = links.nth(1)
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', /.+/)
  const href = await link.getAttribute('href')
  return { link, href: href! }
}

async function expectContextualCategoryRootLink(rootPane: Locator) {
  const agentsLink = rootPane.getByRole('link', { name: 'Agents', exact: true })
  const agentsItem = agentsLink.locator('xpath=ancestor::li[1]')
  expect(await agentsLink.getAttribute('href')).toBeTruthy()
  await expect(agentsLink).not.toHaveClass(/menu__link--sublist/)
  await expect(agentsItem.locator(':scope > div > button.menu__caret')).toHaveCount(0)
  await expect(agentsItem.locator(':scope > ul.menu__list')).toHaveCount(0)
  return agentsLink
}

async function expectStandardMobileCategory(rootPane: Locator) {
  const agentsLink = rootPane.getByRole('link', { name: 'Agents', exact: true })
  const agentsItem = agentsLink.locator('xpath=ancestor::li[1]')
  expect(await agentsLink.getAttribute('href')).toBeTruthy()
  await expect(agentsLink).toHaveClass(/menu__link--sublist/)
  await expect(agentsItem.locator(':scope > div > button.menu__caret')).toHaveCount(1)
  return { agentsItem, agentsLink }
}

async function openMobileSidebar(page: Page) {
  const hamburger = page.getByRole('button', { name: 'Toggle navigation bar' })
  await hamburger.click()
  await expect(page.locator('.navbar-sidebar')).toBeVisible()
}

test.describe('Contextual sidebar', () => {
  test('desktop: contextual root links share the standard link hover layer', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop sidebar not rendered on mobile')

    await page.goto('/docs', { waitUntil: 'domcontentloaded' })
    const rootPane = visibleSidebarPane(page, 'root')
    const standardLink = rootPane.getByRole('link', { name: 'Subagents', exact: true })
    const contextualLink = rootPane.getByRole('link', { name: 'Sandbox', exact: true })

    await standardLink.hover()
    const standardHover = await standardLink.evaluate(link => ({
      backgroundColor: getComputedStyle(link).backgroundColor,
      transition: getComputedStyle(link).transition,
    }))

    await contextualLink.hover()
    const contextualHover = await contextualLink.evaluate(link => ({
      backgroundColor: getComputedStyle(link).backgroundColor,
      transition: getComputedStyle(link).transition,
      chevronContent: getComputedStyle(link, '::after').content,
      parentTagName: link.parentElement?.tagName,
    }))

    expect(contextualHover).toMatchObject({
      backgroundColor: standardHover.backgroundColor,
      transition: standardHover.transition,
      parentTagName: 'LI',
    })
    expect(contextualHover.chevronContent).not.toBe('none')
  })

  test('desktop: navigates child links and restores root focus on Back', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop sidebar not rendered on mobile')
    const getErrors = trackJsErrors(page)

    await page.goto('/docs', { waitUntil: 'domcontentloaded' })
    const rootPane = visibleSidebarPane(page, 'root')
    const agentsLink = await expectContextualCategoryRootLink(rootPane)
    const overviewHref = await agentsLink.getAttribute('href')
    expect(overviewHref).toBeTruthy()

    await page.evaluate(() => {
      const navigation = document.querySelector('nav[aria-label="Docs sidebar"]')
      if (!navigation) throw new Error('Expected the desktop sidebar navigation')

      const observer = new MutationObserver(() => {
        const rootPanel = navigation.querySelector('ul[data-sidebar-panel="root"]')
        const contextualPanel = navigation.querySelector('ul[data-sidebar-panel="contextual"]')
        if (!rootPanel || !contextualPanel || document.documentElement.dataset.sidebarTransitionSample) return

        requestAnimationFrame(() => {
          document.documentElement.dataset.sidebarTransitionSample = JSON.stringify({
            rootAriaHidden: rootPanel.getAttribute('aria-hidden'),
            rootInert: rootPanel.hasAttribute('inert'),
            rootActiveAnimations: rootPanel.getAnimations().filter(animation => animation.playState === 'running')
              .length,
            contextualActiveAnimations: (contextualPanel.parentElement?.getAnimations() ?? []).filter(
              animation => animation.playState === 'running',
            ).length,
          })
          observer.disconnect()
        })
      })
      observer.observe(navigation, { attributes: true, childList: true, subtree: true })
    })

    await agentsLink.click()
    await expect(page).toHaveURL(overviewHref!)
    const contextualPane = visibleSidebarPane(page, 'contextual')
    await expect(contextualPane).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() => {
          const sample = document.documentElement.dataset.sidebarTransitionSample
          return sample ? JSON.parse(sample) : undefined
        }),
      )
      .toMatchObject({ rootAriaHidden: 'true', rootInert: true })
    const transitionSample = await page.evaluate(() =>
      JSON.parse(document.documentElement.dataset.sidebarTransitionSample ?? '{}'),
    )
    expect(transitionSample.rootActiveAnimations).toBeGreaterThan(0)
    expect(transitionSample.contextualActiveAnimations).toBeGreaterThan(0)
    const backButton = contextualPane.getByRole('button', { name: 'Back to global sidebar' })
    await expect(backButton).toHaveText('Agents')
    await expect(contextualPane.getByRole('heading', { name: 'Agents' })).toHaveCount(0)

    const topLevelLinks = contextualTopLevelLinks(contextualPane)
    await expect(topLevelLinks.first()).toHaveAttribute('aria-current', 'page')

    const { link: childLink, href: childHref } = await firstContextualChild(contextualPane)
    await childLink.click()
    await expect(page).toHaveURL(childHref)
    const navigatedContextualPane = visibleSidebarPane(page, 'contextual')
    await expect(navigatedContextualPane).toBeVisible()
    await expect(navigatedContextualPane.locator(`a.menu__link[href="${childHref}"]`)).toHaveAttribute(
      'aria-current',
      'page',
    )

    const urlBeforeBack = page.url()
    await backButton.focus()
    const exitTransition = await backButton.evaluate(button => {
      const panel = button.closest<HTMLElement>('[data-sidebar-panel-container="contextual"]')
      button.click()
      return {
        animationName: panel ? getComputedStyle(panel).animationName : 'none',
        isConnected: panel?.isConnected ?? false,
      }
    })
    expect(exitTransition.isConnected).toBe(true)
    expect(exitTransition.animationName).not.toBe('none')
    const restoredRootPane = visibleSidebarPane(page, 'root')
    await expect(restoredRootPane).toBeVisible()
    await expect(page).toHaveURL(urlBeforeBack)
    await expect(restoredRootPane).toBeFocused()
    const restoredAgentsLink = await expectContextualCategoryRootLink(restoredRootPane)

    await restoredAgentsLink.click()
    await expect(visibleSidebarPane(page, 'contextual')).toBeVisible()
    await page.getByRole('link', { name: 'Docs', exact: true }).first().click()
    await expect(page).toHaveURL('/docs')
    await expect(visibleSidebarPane(page, 'root')).toBeVisible()

    expect(getErrors(), 'JS errors during contextual sidebar navigation').toEqual([])
  })

  test('desktop: restores root sidebar scrolling when leaving a contextual pane', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop sidebar not rendered on mobile')
    await page.setViewportSize({ width: 1200, height: 360 })

    await page.goto('/docs', { waitUntil: 'domcontentloaded' })
    const rootPane = visibleSidebarPane(page, 'root')
    const guidesLink = rootPane.getByRole('link', { name: 'Guides', exact: true })
    await expect(guidesLink).toBeVisible()
    const rootScrollTop = await guidesLink.evaluate(element => {
      element.scrollIntoView({ block: 'center' })
      return element.closest('nav')?.scrollTop ?? 0
    })
    expect(rootScrollTop).toBeGreaterThan(0)

    await guidesLink.evaluate((element: HTMLAnchorElement) => element.click())
    const contextualPane = visibleSidebarPane(page, 'contextual')
    await expect(contextualPane).toBeVisible()
    await expect.poll(() => contextualPane.evaluate(element => element.scrollTop)).toBe(0)

    await contextualPane
      .getByRole('button', { name: 'Back to global sidebar' })
      .evaluate((element: HTMLButtonElement) => element.click())
    const restoredRootPane = visibleSidebarPane(page, 'root')
    await expect(restoredRootPane).toBeVisible()
    await expect.poll(() => restoredRootPane.evaluate(element => element.scrollTop)).toBe(rootScrollTop)
    await expect(restoredRootPane.getByRole('link', { name: 'Guides', exact: true })).toBeInViewport()

    await page.setViewportSize({ width: 1200, height: 480 })
    await page.goto('/docs/observability/overview', { waitUntil: 'domcontentloaded' })
    const shortContextualPane = visibleSidebarPane(page, 'contextual')
    await expect(shortContextualPane).toBeVisible()
    expect(
      await shortContextualPane.evaluate(element => element.scrollHeight > element.clientHeight + 1),
      'A short contextual pane should not inherit overflow from the hidden root pane',
    ).toBe(false)
  })

  test('desktop: keeps version control aligned and visible inside the sidebar scrollport', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop sidebar not rendered on mobile')
    await page.setViewportSize({ width: 1200, height: 360 })

    await page.goto('/docs', { waitUntil: 'domcontentloaded' })
    const rootPane = visibleSidebarPane(page, 'root')
    const versionControl = rootPane.getByRole('button', { name: 'Change version' })

    await expect(versionControl).toBeVisible()
    const alignment = await rootPane.evaluate(element => {
      const list = element.querySelector('ul[data-sidebar-panel="root"]')
      const button = element.querySelector('button[aria-label="Change version"]')
      if (!(list instanceof HTMLElement) || !(button instanceof HTMLElement)) {
        throw new Error('Expected the root sidebar list and version control')
      }

      const navigationRect = element.getBoundingClientRect()
      const listRect = list.getBoundingClientRect()
      const buttonRect = button.getBoundingClientRect()
      return {
        listLeft: listRect.left - buttonRect.left,
        listRight: listRect.right - buttonRect.right,
        outerLeft: buttonRect.left - navigationRect.left,
        outerRight: navigationRect.right - buttonRect.right,
        scrollbarGutter: element.offsetWidth - element.clientWidth,
      }
    })
    expect(Math.abs(alignment.listLeft)).toBeLessThan(1)
    expect(Math.abs(alignment.listRight)).toBeLessThan(1)
    expect(alignment.outerLeft).toBeCloseTo(16, 0)
    expect(alignment.outerRight).toBeGreaterThanOrEqual(alignment.outerLeft - 1)
    expect(alignment.outerRight).toBeLessThanOrEqual(alignment.outerLeft + alignment.scrollbarGutter + 1)

    const initialBottom = await versionControl.evaluate(element => element.getBoundingClientRect().bottom)
    await rootPane.evaluate(element => {
      element.scrollTop = element.scrollHeight / 2
    })
    await expect.poll(() => rootPane.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
    await expect(versionControl).toBeVisible()
    await expect
      .poll(() => versionControl.evaluate(element => element.getBoundingClientRect().bottom))
      .toBeCloseTo(initialBottom, 0)
  })

  test('desktop: body links switch to the destination contextual sidebar', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop sidebar not rendered on mobile')

    await page.goto('/docs/workflows/overview', { waitUntil: 'domcontentloaded' })
    const workflowsPane = visibleSidebarPane(page, 'contextual')
    await expect(workflowsPane).toBeVisible()
    await expect(workflowsPane.getByRole('button', { name: 'Back to global sidebar' })).toHaveText('Workflows')

    await page.locator('main').getByRole('link', { name: 'workflow runners', exact: true }).click()
    await expect(page).toHaveURL('/docs/deployment/workflow-runners')

    const deploymentPane = visibleSidebarPane(page, 'contextual')
    await expect(deploymentPane).toBeVisible()
    await expect(deploymentPane.getByRole('button', { name: 'Back to global sidebar' })).toHaveText('Deploy')
    await expect(deploymentPane.locator('a.menu__link[href="/docs/deployment/workflow-runners"]')).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('desktop: direct destination loads initialize context while later history remains transient', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop sidebar not rendered on mobile')

    await page.goto('/docs', { waitUntil: 'domcontentloaded' })
    const categoryLink = await expectContextualCategoryRootLink(visibleSidebarPane(page, 'root'))
    const overviewHref = await categoryLink.getAttribute('href')
    expect(overviewHref).toBeTruthy()
    await categoryLink.click()
    const contextualPane = visibleSidebarPane(page, 'contextual')
    await expect(contextualPane).toBeVisible()
    const { href: childHref } = await firstContextualChild(contextualPane)

    for (const path of [overviewHref!, childHref]) {
      const directResponse = await page.request.get(path)
      expect(directResponse.ok()).toBe(true)
      expect(await directResponse.text()).toMatch(/data-sidebar-pane=(?:"contextual"|contextual)/)
    }

    await page.goBack()
    await expect(page).toHaveURL('/docs')
    await expect(visibleSidebarPane(page, 'root')).toBeVisible()
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))
    await page.goForward()
    await expect(page).toHaveURL(overviewHref!)
    await expect(visibleSidebarPane(page, 'root')).toBeVisible()

    await page.reload()
    const directContextualPane = visibleSidebarPane(page, 'contextual')
    await expect(directContextualPane).toBeVisible()
    await expect
      .poll(() =>
        directContextualPane
          .locator('[data-sidebar-panel-container="contextual"]')
          .evaluate(element => getComputedStyle(element).animationName),
      )
      .toBe('none')
    await directContextualPane.getByRole('button', { name: 'Back to global sidebar' }).click()
    const directRootPane = visibleSidebarPane(page, 'root')
    await expect(directRootPane).toBeVisible()
    await expect(page).toHaveURL(overviewHref!)

    await (await expectContextualCategoryRootLink(directRootPane)).click()
    const reenteredContextualPane = visibleSidebarPane(page, 'contextual')
    await expect(reenteredContextualPane).toBeVisible()
    await expect
      .poll(() =>
        reenteredContextualPane
          .locator('[data-sidebar-panel-container="contextual"]')
          .evaluate(element => getComputedStyle(element).animationName),
      )
      .not.toBe('none')

    await page.goto(childHref, { waitUntil: 'domcontentloaded' })
    const directChildPane = visibleSidebarPane(page, 'contextual')
    await expect(directChildPane).toBeVisible()
    await expect(directChildPane.locator(`a.menu__link[href="${childHref}"]`)).toHaveAttribute('aria-current', 'page')
    await page.reload()
    await expect(visibleSidebarPane(page, 'contextual')).toBeVisible()
    await visibleSidebarPane(page, 'contextual').getByRole('button', { name: 'Back to global sidebar' }).click()
    await expect(visibleSidebarPane(page, 'root')).toBeVisible()
    await expect(page).toHaveURL(childHref)
  })

  test('desktop: modified click leaves the opener unchanged and the new overview tab initializes context', async ({
    page,
    context,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop sidebar not rendered on mobile')

    await page.goto('/docs', { waitUntil: 'domcontentloaded' })
    const agentsLink = await expectContextualCategoryRootLink(visibleSidebarPane(page, 'root'))
    const overviewHref = await agentsLink.getAttribute('href')
    expect(overviewHref).toBeTruthy()
    const newPagePromise = context.waitForEvent('page')
    await agentsLink.click({ button: 'middle' })
    const newPage = await newPagePromise
    await newPage.waitForLoadState('domcontentloaded')

    await expect(page).toHaveURL('/docs')
    const unchangedRootPane = visibleSidebarPane(page, 'root')
    await expect(unchangedRootPane).toBeVisible()
    await expectContextualCategoryRootLink(unchangedRootPane)
    await expect(newPage).toHaveURL(overviewHref!)
    const directContextualPane = visibleSidebarPane(newPage, 'contextual')
    await expect(directContextualPane).toBeVisible()

    const { link: childLink, href: childHref } = await firstContextualChild(directContextualPane)
    const childPagePromise = context.waitForEvent('page')
    await childLink.click({ button: 'middle' })
    const childPage = await childPagePromise
    await childPage.waitForLoadState('domcontentloaded')

    await expect(newPage).toHaveURL(overviewHref!)
    await expect(visibleSidebarPane(newPage, 'contextual')).toBeVisible()
    await expect(childPage).toHaveURL(childHref)
    await expect(visibleSidebarPane(childPage, 'contextual')).toBeVisible()
  })

  test('mobile and tablet: contextual categories use standard expandable sidebar behavior', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Mobile sidebar only renders on mobile and tablet')
    const getErrors = trackJsErrors(page)

    await page.goto('/docs', { waitUntil: 'domcontentloaded' })
    await openMobileSidebar(page)
    const rootPane = visibleSidebarPane(page, 'root')
    const { agentsItem, agentsLink } = await expectStandardMobileCategory(rootPane)
    await expect(visibleSidebarPane(page, 'contextual')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Back to global sidebar' })).toHaveCount(0)
    await expect(agentsItem).toHaveClass(/menu__list-item--collapsed/)

    await agentsItem.locator(':scope > div > button.menu__caret').click()
    await expect(agentsItem).not.toHaveClass(/menu__list-item--collapsed/)
    const childLinks = agentsItem.locator(':scope > ul.menu__list a.menu__link[href]')
    expect(await childLinks.count()).toBeGreaterThan(0)
    const childHref = await childLinks.first().getAttribute('href')
    expect(childHref).toBeTruthy()

    const overviewHref = await agentsLink.getAttribute('href')
    expect(overviewHref).toBeTruthy()
    await agentsLink.click()
    await expect(page).toHaveURL(overviewHref!)
    await expect(page.locator('.navbar-sidebar')).not.toBeVisible()

    await openMobileSidebar(page)
    const activeRootPane = visibleSidebarPane(page, 'root')
    const activeCategory = await expectStandardMobileCategory(activeRootPane)
    await expect(activeCategory.agentsItem).not.toHaveClass(/menu__list-item--collapsed/)
    await expect(visibleSidebarPane(page, 'contextual')).toHaveCount(0)
    await activeCategory.agentsItem.locator(`a.menu__link[href="${childHref}"]`).click()
    await expect(page).toHaveURL(childHref!)
    await expect(page.locator('.navbar-sidebar')).not.toBeVisible()

    await page.reload()
    await openMobileSidebar(page)
    const directRootPane = visibleSidebarPane(page, 'root')
    await expectStandardMobileCategory(directRootPane)
    await expect(directRootPane.locator(`a.menu__link[href="${childHref}"]`)).toHaveAttribute('aria-current', 'page')
    await expect(visibleSidebarPane(page, 'contextual')).toHaveCount(0)

    expect(getErrors(), 'JS errors during mobile sidebar navigation').toEqual([])
  })

  test('mobile and tablet: modified clicks keep the standard sidebar in both tabs', async ({
    page,
    context,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Mobile sidebar only renders on mobile and tablet')

    await page.goto('/docs', { waitUntil: 'domcontentloaded' })
    await openMobileSidebar(page)
    const rootPane = visibleSidebarPane(page, 'root')
    const { agentsLink } = await expectStandardMobileCategory(rootPane)
    const overviewHref = await agentsLink.getAttribute('href')
    expect(overviewHref).toBeTruthy()

    const newPagePromise = context.waitForEvent('page')
    await agentsLink.click({ button: 'middle' })
    const newPage = await newPagePromise
    await newPage.waitForLoadState('domcontentloaded')

    await expect(page).toHaveURL('/docs')
    await expect(page.locator('.navbar-sidebar')).toBeVisible()
    await expectStandardMobileCategory(visibleSidebarPane(page, 'root'))
    await expect(visibleSidebarPane(page, 'contextual')).toHaveCount(0)

    await expect(newPage).toHaveURL(overviewHref!)
    await openMobileSidebar(newPage)
    await expectStandardMobileCategory(visibleSidebarPane(newPage, 'root'))
    await expect(visibleSidebarPane(newPage, 'contextual')).toHaveCount(0)
    await expect(newPage.getByRole('button', { name: 'Back to global sidebar' })).toHaveCount(0)
  })
})

// ─── Admonitions and tabs on /integrations/agentic-ui/ai-sdk-ui ───────

test.describe('Admonitions and tabs on AI SDK UI guide', () => {
  const PAGE = '/integrations/agentic-ui/ai-sdk-ui'

  test('admonitions are rendered and visible', async ({ page }) => {
    const getErrors = trackJsErrors(page)

    await page.goto(PAGE, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')

    // The page has admonitions of types: note, tip, warning.
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

    for (const type of ['note', 'tip', 'warning']) {
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
