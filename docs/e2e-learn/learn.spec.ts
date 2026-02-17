import { test, expect } from '@playwright/test'

test.describe('Learn section', () => {
  test('landing page renders with course title and all 17 lessons', async ({ page }) => {
    await page.goto('/learn')
    await expect(page.locator('h1')).toContainText('Build Your First AI Agent')
    const lessonLinks = page.locator('a[href^="/learn/"]')
    await expect(lessonLinks.first()).toBeVisible()
    const count = await lessonLinks.count()
    expect(count).toBeGreaterThanOrEqual(17)
  })

  test('progress bar starts at zero', async ({ page }) => {
    await page.goto('/learn')
    await expect(page.locator('aside').getByText('0 of 4 completed · 13 coming soon')).toBeVisible()
  })

  test('published lesson navigation works', async ({ page }) => {
    await page.goto('/learn')
    await page.locator('main a[href="/learn/01-what-is-an-agent"]').first().click()
    await expect(page).toHaveURL(/\/learn\/01-what-is-an-agent/)
  })

  test('published lesson page has expected structure', async ({ page }) => {
    await page.goto('/learn/01-what-is-an-agent')
    // Header
    await expect(page.getByText('Lesson 1 of 17')).toBeVisible()
    await expect(page.locator('h1')).toContainText('What Is an Agent')
    // Watched checkbox
    await expect(page.getByText('Mark as watched')).toBeVisible()
    // Prev/Next nav - use the main content area's nav, not sidebar
    await expect(page.locator('main nav a').filter({ hasText: 'Setup and First Run' })).toBeVisible()
  })

  test('coming soon lesson shows preview and CTA', async ({ page }) => {
    await page.goto('/learn/05-build-your-first-tool')
    await expect(page.locator('h1')).toContainText('Build Your First Tool')
    await expect(page.locator('main').getByText('Coming Soon', { exact: true })).toBeVisible()
    // Preview bullets
    await expect(page.getByText('A tool is a function the agent can call')).toBeVisible()
    // Email CTA
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
  })

  test('sidebar shows all lessons grouped by module', async ({ page }) => {
    await page.goto('/learn')
    const sidebar = page.locator('aside')
    await expect(sidebar.getByRole('heading', { name: 'Getting Started' })).toBeVisible()
    await expect(sidebar.getByRole('heading', { name: 'Tools' })).toBeVisible()
    await expect(sidebar.getByRole('heading', { name: 'Workflows' })).toBeVisible()
    await expect(sidebar.getByRole('heading', { name: 'Memory' })).toBeVisible()
    await expect(sidebar.getByRole('heading', { name: 'Production' })).toBeVisible()
  })

  test('sidebar navigation works between lessons', async ({ page }) => {
    await page.goto('/learn/01-what-is-an-agent')
    // Click next lesson in sidebar
    await page.locator('aside a[href="/learn/02-setup-and-first-run"]').click()
    await expect(page).toHaveURL(/\/learn\/02-setup-and-first-run/)
    await expect(page.locator('h1')).toContainText('Setup and First Run')
  })

  test('watched checkbox persists via localStorage', async ({ page }) => {
    await page.goto('/learn/01-what-is-an-agent')
    const checkbox = page.locator('input[type="checkbox"]')
    await checkbox.check()
    await expect(checkbox).toBeChecked()

    // Navigate away and back to verify localStorage persistence
    await page.goto('/learn')
    await page.goto('/learn/01-what-is-an-agent')
    await expect(page.locator('input[type="checkbox"]')).toBeChecked({ timeout: 10000 })
  })

  test('progress updates after marking lesson watched', async ({ page }) => {
    await page.goto('/learn/01-what-is-an-agent')
    await page.locator('input[type="checkbox"]').check()
    await page.goto('/learn')
    await expect(page.locator('aside').getByText('1 of 4 completed · 13 coming soon')).toBeVisible()
  })

  test('continue card shows next unwatched lesson', async ({ page }) => {
    await page.goto('/learn')
    // With no lessons watched, continue card should show the first published lesson
    await expect(page.getByText('Continue learning')).toBeVisible()
    await expect(page.locator('main a').filter({ hasText: 'What Is an Agent' }).first()).toBeVisible()
  })

  test('prev/next navigation works', async ({ page }) => {
    await page.goto('/learn/02-setup-and-first-run')
    // Click next in the main content nav (not sidebar)
    const nextLink = page.locator('main nav a[href="/learn/03-scaffolded-project-walkthrough"]')
    await nextLink.click()
    await expect(page).toHaveURL(/\/learn\/03-scaffolded-project-walkthrough/)
    // Click prev
    const prevLink = page.locator('main nav a[href="/learn/02-setup-and-first-run"]')
    await prevLink.click()
    await expect(page).toHaveURL(/\/learn\/02-setup-and-first-run/)
  })

  test('nonexistent lesson shows not found', async ({ page }) => {
    await page.goto('/learn/nonexistent-lesson')
    // In dev mode, Docusaurus returns 200 but renders a "Page Not Found" page
    await expect(page.getByText('Page Not Found')).toBeVisible()
  })

  test('Learn tab visible in navbar', async ({ page }) => {
    await page.goto('/learn')
    const learnTab = page.locator('.tab a').filter({ hasText: 'Learn' })
    await expect(learnTab).toBeVisible()
  })

  test('email CTA form is visible on coming soon pages', async ({ page }) => {
    await page.goto('/learn/06-mcp-docs-server')
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
    await expect(page.getByText('Subscribe')).toBeVisible()
  })

  test('mobile toggle opens sidebar on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/learn')
    // Mobile toggle should be visible
    const toggle = page.getByRole('button', { name: 'Toggle course sidebar' })
    await expect(toggle).toBeVisible()
    // Sidebar should be off-screen initially
    const sidebar = page.locator('aside.learn-sidebar-container')
    await expect(sidebar).not.toHaveClass(/is-open/)
    // Click toggle to open sidebar
    await toggle.click()
    await expect(sidebar).toHaveClass(/is-open/)
    // Click a lesson to close sidebar and navigate
    await page.locator('aside a[href="/learn/01-what-is-an-agent"]').click()
    await expect(page).toHaveURL(/\/learn\/01-what-is-an-agent/)
  })
})
